import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { recomputeMaterial } from '../utils/stock.js';
import { toAgendamentoGet } from '../utils/dto.js';
import { recalcularEstadoActividade } from '../utils/actividade_estado.js';

const router = Router();
router.use(authRequired);
const MOVE_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const agInclude = { actividade: { include: { laboratorio: true } } };

// Após gravar UMA das confirmações, re-avalia a sessão dentro da transação:
// quando professor e técnico já confirmaram e a sessão ainda não está realizada,
// marca `realizado=true` e faz a baixa automática de stock UMA única vez.
// Sempre recalcula o estado da atividade. Robusto a pedidos concorrentes/fora de ordem.
async function finalizarSeCompleto(tx, agId, utilizadorId) {
  const ag = await tx.agendamento.findUnique({
    where: { id: agId },
    include: { _count: { select: { historico: true } } },
  });
  if (!ag) return;

  if (ag.confirmado_professor_em && ag.confirmado_tecnico_em && !ag.realizado) {
    await tx.agendamento.update({ where: { id: agId }, data: { realizado: true } });
    if (ag._count.historico === 0) {
      // Passo 5: baixa automática de stock (uma única vez, quando passa a realizada)
      const pedidos = await tx.actividadeMaterial.findMany({
        where: { actividade_id: ag.actividade_id, activo: true },
      });
      for (const ped of pedidos) {
        const qtd = -Number(ped.quantidade_estimada || 0);
        if (qtd === 0) continue;
        await tx.historicoMaterial.create({
          data: {
            material_id: ped.material_id,
            utilizador_id: utilizadorId,
            agendamento_id: agId,
            quantidade_movimentada: qtd,
            motivo: 'consumo_actividade',
            descricao: 'Consumo automático após confirmação de presença',
          },
        });
        await recomputeMaterial(ped.material_id, tx);
      }
    }
  }
  await recalcularEstadoActividade(tx, ag.actividade_id);
}

// GET /agendamentos — listar (filtros laboratorio_id, mes, ano). Só aprovado_supervisor (RF12).
router.get('/', async (req, res, next) => {
  try {
    const where = {
      activo: true,
      estado: 'aprovado_supervisor',
      actividade: { activo: true },
    };
    if (req.query.laboratorio_id) where.actividade.laboratorio_id = Number(req.query.laboratorio_id);
    if (req.query.de && req.query.ate) {
      const parse = (v) => {
        const [y, m, d] = String(v).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      };
      where.hora_inicio = { gte: parse(req.query.de), lt: parse(req.query.ate) };
    } else if (req.query.mes && req.query.ano) {
      const mes = Number(req.query.mes);
      const ano = Number(req.query.ano);
      const start = new Date(ano, mes - 1, 1);
      const end = new Date(ano, mes, 1);
      where.hora_inicio = { gte: start, lt: end };
    }
    const rows = await prisma.agendamento.findMany({
      where,
      include: agInclude,
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toAgendamentoGet));
  } catch (err) {
    next(err);
  }
});

// PUT /agendamentos/:id/confirmar-professor — professor marcou como concluído (A,P do dono)
router.put('/:id/confirmar-professor', rbac('admin', 'professor'), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(req.params.id) },
      include: { actividade: { select: { estado: true, responsavel_id: true } } },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    if (ag.estado !== 'aprovado_supervisor') {
      return res.status(409).json({ message: 'O agendamento ainda não foi aprovado pelo Supervisor; só pode ser concluído após a aprovação final.' });
    }
    if (req.user.tipo === 'professor' && ag.actividade.responsavel_id !== req.user.id) {
      return res.status(403).json({ message: 'Apenas o professor responsável pela atividade pode confirmar a presença.' });
    }
    const atualizado = await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({
        where: { id: ag.id },
        data: { confirmado_professor_em: new Date() },
      });
      await finalizarSeCompleto(tx, ag.id, req.user.id);
      return tx.agendamento.findUnique({ where: { id: ag.id }, include: agInclude });
    });
    res.json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// PUT /agendamentos/:id/confirmar-tecnico — técnico confirmou; quando ambos, realizada → baixa stock (T validador)
// RF14: valida contra AgendamentoTecnico (papel=validador) DA SESSÃO específica.
router.put('/:id/confirmar-tecnico', rbac('tecnico', 'admin'), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(req.params.id) },
      include: { actividade: { select: { estado: true, responsavel_id: true } } },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    if (ag.estado !== 'aprovado_supervisor') {
      return res.status(409).json({ message: 'O agendamento ainda não foi aprovado pelo Supervisor; só pode ser concluído após a aprovação final.' });
    }
    if (req.user.tipo === 'tecnico') {
      const vinculacao = await prisma.agendamentoTecnico.findFirst({
        where: { agendamento_id: ag.id, utilizador_id: req.user.id, papel: 'validador', activo: true },
      });
if (!vinculacao) {
        return res.status(403).json({ message: 'Apenas o técnico (validador) atribuído a este agendamento pode confirmar o término. Este agendamento ainda não tem validador atribuído.' });
      }
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({
        where: { id: ag.id },
        data: { confirmado_tecnico_em: new Date() },
      });
      await finalizarSeCompleto(tx, ag.id, req.user.id);
      return tx.agendamento.findUnique({ where: { id: ag.id }, include: agInclude });
    });
    res.json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// POST /agendamentos — criar (valida choque RF13). num_participantes obrigatório.
router.post('/', rbac(...MOVE_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, num_participantes, hora_inicio, hora_fim } = req.body || {};
    if (!actividade_id || !hora_inicio || !hora_fim) {
      return res.status(400).json({ message: 'actividade_id, hora_inicio e hora_fim são obrigatórios' });
    }
    const participantes = Number(num_participantes);
    if (!Number.isInteger(participantes) || participantes < 1) {
      return res.status(400).json({ message: 'num_participantes é obrigatório e deve ser maior que zero' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    const start = new Date(hora_inicio).getTime();
    const end = new Date(hora_fim).getTime();
    if (start >= end) return res.status(400).json({ message: 'hora_fim deve ser posterior a hora_inicio' });

    // RF13: bloquear choque com agendamentos aprovado_supervisor no mesmo lab
    const aprovados = await prisma.agendamento.findMany({
      where: {
        activo: true,
        estado: 'aprovado_supervisor',
        actividade: { laboratorio_id: act.laboratorio_id },
      },
      select: { hora_inicio: true, hora_fim: true },
    });
    const choque = aprovados.some((g) => {
      const gs = new Date(g.hora_inicio).getTime();
      const ge = new Date(g.hora_fim).getTime();
      return start < ge && gs < end;
    });
    if (choque) {
      return res.status(409).json({ message: 'Choque de horário: já existe um agendamento aprovado neste laboratório no intervalo indicado.' });
    }

    const novo = await prisma.agendamento.create({
      data: {
        actividade_id: Number(actividade_id),
        num_participantes: participantes,
        hora_inicio: new Date(hora_inicio),
        hora_fim: new Date(hora_fim),
      },
      include: agInclude,
    });
    res.status(201).json(toAgendamentoGet(novo));
  } catch (err) {
    next(err);
  }
});

// POST /agendamentos/:id/tecnicos — atribuição MANUAL de técnicos (Admin/Supervisor).
// Apenas para agendamentos já aprovados pelo Supervisor que ficaram sem atribuição
// (ex.: dados antigos). Body: { validador_id, assistente_id } — ambos obrigatórios
// e podem ser a mesma pessoa. Sem edição pós-atribuição.
router.post('/:id/tecnicos', rbac('admin', 'supervisor'), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(req.params.id) },
      include: { tecnicos: { where: { activo: true } } },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    if (ag.estado !== 'aprovado_supervisor') {
      return res.status(409).json({ message: 'Só é possível atribuir técnicos a um agendamento aprovado pelo Supervisor' });
    }
    if (ag.tecnicos.length > 0) {
      return res.status(409).json({ message: 'Este agendamento já tem técnicos atribuídos' });
    }
    const validadorId = Number(req.body?.validador_id);
    const assistenteId = Number(req.body?.assistente_id);
    if (!Number.isInteger(validadorId) || !Number.isInteger(assistenteId)) {
      return res.status(400).json({ message: 'validador_id e assistente_id são obrigatórios' });
    }
    const users = await prisma.utilizador.findMany({
      where: { id: { in: [validadorId, assistenteId] }, activo: true, tipo: 'tecnico' },
      select: { id: true },
    });
    const encontrados = new Set(users.map((u) => u.id));
    if (!encontrados.has(validadorId) || !encontrados.has(assistenteId)) {
      return res.status(400).json({ message: 'O técnico validador/assistente tem de ser um utilizador ativo com o papel técnico' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.agendamentoTecnico.createMany({
        data: [
          { agendamento_id: ag.id, utilizador_id: validadorId, papel: 'validador' },
          { agendamento_id: ag.id, utilizador_id: assistenteId, papel: 'assistente' },
        ],
      });
      await recalcularEstadoActividade(tx, ag.actividade_id);
    });

    const atualizado = await prisma.agendamento.findUnique({
      where: { id: ag.id },
      include: { ...agInclude, tecnicos: { where: { activo: true }, include: { utilizador: true } } },
    });
    res.status(201).json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// PUT /agendamentos/:id — atualizar horário/participantes
router.put('/:id', rbac(...MOVE_ROLES), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: Number(req.params.id) } });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    const { hora_inicio, hora_fim, num_participantes } = req.body || {};
    const data = {};
    if (hora_inicio !== undefined) data.hora_inicio = new Date(hora_inicio);
    if (hora_fim !== undefined) data.hora_fim = new Date(hora_fim);
    if (num_participantes !== undefined) {
      const participantes = Number(num_participantes);
      if (!Number.isInteger(participantes) || participantes < 1) {
        return res.status(400).json({ message: 'num_participantes deve ser maior que zero' });
      }
      data.num_participantes = participantes;
    }
    const atualizado = await prisma.agendamento.update({ where: { id: ag.id }, data, include: agInclude });
    res.json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// DELETE /agendamentos/:id — soft
router.delete('/:id', rbac(...MOVE_ROLES), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: Number(req.params.id) } });
    if (!ag) return res.status(404).json({ message: 'Agendamento não encontrado' });
    await prisma.agendamento.update({ where: { id: ag.id }, data: { activo: false } });
    res.json({ message: 'Agendamento removido' });
  } catch (err) {
    next(err);
  }
});

export default router;