import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { recomputeMaterial } from '../utils/stock.js';
import { toAgendamentoGet } from '../utils/dto.js';

const router = Router();
router.use(authRequired);
const MOVE_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const agInclude = { actividade: { include: { laboratorio: true } } };

// GET /agendamentos — listar (filtros laboratorio_id, mes, ano). Só aprovado_supervisor (RF12).
router.get('/', async (req, res, next) => {
  try {
    const where = {
      activo: true,
      estado: 'aprovado_supervisor',
      actividade: { activo: true },
    };
    if (req.query.laboratorio_id) where.actividade.laboratorio_id = Number(req.query.laboratorio_id);
    if (req.query.mes && req.query.ano) {
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
      include: { actividade: { select: { estado: true, utilizador_id: true } } },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    if (ag.estado !== 'aprovado_supervisor') {
      return res.status(409).json({ message: 'O agendamento ainda não foi aprovado pelo Supervisor; só pode ser concluído após a aprovação final.' });
    }
    if (req.user.tipo === 'professor' && ag.actividade.utilizador_id !== req.user.id) {
      return res.status(403).json({ message: 'Apenas o professor responsável pela atividade pode confirmar a presença.' });
    }
    const atualizado = await prisma.agendamento.update({
      where: { id: ag.id },
      data: { confirmado_professor_em: new Date() },
      include: agInclude,
    });
    res.json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// PUT /agendamentos/:id/confirmar-tecnico — técnico confirmou; quando ambos, realizada → baixa stock (T validador)
router.put('/:id/confirmar-tecnico', rbac('tecnico', 'admin'), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(req.params.id) },
      include: { actividade: { select: { estado: true } } },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    if (ag.estado !== 'aprovado_supervisor') {
      return res.status(409).json({ message: 'O agendamento ainda não foi aprovado pelo Supervisor; só pode ser concluído após a aprovação final.' });
    }
    if (req.user.tipo === 'tecnico') {
      const vinculacao = await prisma.actividadeTecnico.findFirst({
        where: { actividade_id: ag.actividade_id, utilizador_id: req.user.id, papel: 'validador', activo: true },
      });
      if (!vinculacao) {
        return res.status(403).json({ message: 'Apenas o técnico (validador) atribuído à atividade pode confirmar o término.' });
      }
    }

    const jaRealizada = ag.realizado;
    const updateData = { confirmado_tecnico_em: new Date() };
    if (ag.confirmado_professor_em && !jaRealizada) {
      updateData.realizado = true;
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      const result = await tx.agendamento.update({ where: { id: ag.id }, data: updateData, include: agInclude });

      if (ag.confirmado_professor_em && !jaRealizada) {
        // Passo 5: baixa automática de stock (uma única vez, quando passa a realizada)
        const pedidos = await tx.actividadeMaterial.findMany({
          where: { actividade_id: ag.actividade_id, activo: true },
          include: { material: true },
        });
        for (const ped of pedidos) {
          const qtd = -Number(ped.quantidade_estimada || 0);
          if (qtd === 0) continue;
          await tx.historicoMaterial.create({
            data: {
              material_id: ped.material_id,
              utilizador_id: req.user.id,
              actividade_id: ag.actividade_id,
              quantidade_movimentada: qtd,
              motivo: 'consumo_actividade',
              descricao: 'Consumo automático após confirmação de presença',
            },
          });
          await recomputeMaterial(ped.material_id, tx);
        }
      }
      return result;
    });
    res.json(toAgendamentoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// POST /agendamentos — criar (valida choque RF13)
router.post('/', rbac(...MOVE_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, hora_inicio, hora_fim } = req.body || {};
    if (!actividade_id || !hora_inicio || !hora_fim) {
      return res.status(400).json({ message: 'actividade_id, hora_inicio e hora_fim são obrigatórios' });
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

// PUT /agendamentos/:id — atualizar horário
router.put('/:id', rbac(...MOVE_ROLES), async (req, res, next) => {
  try {
    const ag = await prisma.agendamento.findUnique({ where: { id: Number(req.params.id) } });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    const { hora_inicio, hora_fim } = req.body || {};
    const data = {};
    if (hora_inicio !== undefined) data.hora_inicio = new Date(hora_inicio);
    if (hora_fim !== undefined) data.hora_fim = new Date(hora_fim);
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