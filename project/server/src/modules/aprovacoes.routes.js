import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toAprovacaoGet } from '../utils/dto.js';
import { podeVotarEtapa } from '../utils/fluxo.js';

// Fila principal /aprovacoes
const fila = Router();
fila.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'));

// Linha sintética da fila — o id é o da atividade para navegação /aprovacoes/{id}
function toFilaRow(act) {
  const etapa = act.estado === 'revisado_dlab' ? 'supervisor' : 'dlab';
  return {
    id: act.id,
    actividade_id: act.id,
    actividade_nome: act.nome,
    aprovador_id: 0,
    aprovador_nome: '',
    etapa,
    decisao: '',
    comentario: '',
    decidido_em: '',
    criado_em: act.criado_em,
    actualizado_em: act.actualizado_em,
  };
}

const APROVACAO_INCLUDE = {
  aprovador: true,
  agendamento: { include: { actividade: { select: { nome: true } } } },
  actividade: { select: { nome: true } },
  aprovacaoAgendamentos: { include: { agendamento: { include: { actividade: { select: { nome: true } } } } } },
};

// Estado alvo da fila por role, derivado do fluxo configurável (PLANO.md §3):
// quem vota na etapa superior vê revisado_dlab; quem vota só no DLab vê pendente;
// quem vota em ambas (ex.: admin) vê as duas.
async function estadosFila(userTipo) {
  if (userTipo === 'admin') return { in: ['pendente', 'revisado_dlab'] };
  const sup = await podeVotarEtapa('supervisor', userTipo);
  const dlab = await podeVotarEtapa('dlab', userTipo);
  if (sup && !dlab) return 'revisado_dlab';
  if (dlab && !sup) return 'pendente';
  if (sup && dlab) return { in: ['pendente', 'revisado_dlab'] };
  return 'pendente'; // leitor (chefe_departamento, etc.)
}

// GET /aprovacoes — fila adaptativa (RF09/RF10). Admin vê ambas as etapas.
fila.get('/', async (req, res, next) => {
  try {
    const where = { activo: true };
    where.estado = await estadosFila(req.user.tipo);
    const acts = await prisma.actividade.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    res.json(acts.map(toFilaRow));
  } catch (err) {
    next(err);
  }
});

// GET /aprovacoes/:id — :id é o actividade_id (fila keyed por atividade)
fila.get('/:id', async (req, res, next) => {
  try {
    const act = await prisma.actividade.findFirst({ where: { id: Number(req.params.id), activo: true } });
    if (!act) return res.status(404).json({ message: 'Atividade não encontrada' });
    res.json(toFilaRow(act));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes — voto INDIVIDUAL por agendamento.
// Body: { agendamento_id, etapa, decisao, comentario? }
// Nenhuma ação individual (aprovar/rejeitar; "Deixar pendente" em POST /pendente)
// exige comentário: o estado dos agendamentos não fecha o fluxo automaticamente.
// O comentário é obrigatório apenas nos botões de conclusão de etapa e na
// rejeição da atividade.
fila.post('/', async (req, res, next) => {
  try {
    const { agendamento_id, etapa, decisao, comentario } = req.body || {};
    if (!agendamento_id || !etapa || !decisao) {
      return res.status(400).json({ message: 'agendamento_id, etapa e decisao são obrigatórios' });
    }
    if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });
    if (!['aprovado', 'rejeitado'].includes(decisao)) return res.status(400).json({ message: 'decisao inválida' });
    const texto = (comentario || '').trim();

    // RBAC por etapa (configurável)
    if (!(await podeVotarEtapa(etapa, req.user.tipo))) {
      return res.status(403).json({ message: 'Não está autorizado a votar nesta etapa' });
    }

    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(agendamento_id) },
      include: { actividade: true },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    const act = ag.actividade;
    if (!act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // Validações de sequência
    if (etapa === 'dlab') {
      if (act.estado !== 'pendente') {
        return res.status(409).json({ message: 'A atividade já não está na fase de revisão do DLab' });
      }
      if (ag.estado !== 'nao_revisto') {
        return res.status(409).json({ message: 'Este agendamento já foi decidido ou deixado pendente pelo DLab' });
      }
    } else {
      if (act.estado !== 'revisado_dlab') {
        return res.status(409).json({ message: 'A atividade ainda não concluiu a revisão do DLab' });
      }
      if (ag.estado !== 'aprovado_dlab' && ag.estado !== 'pendente') {
        return res.status(409).json({ message: 'Este agendamento já foi decidido pelo Supervisor' });
      }
    }

    // Nota: nenhuma ação individual (aprovar/rejeitar/deixar pendente) exige
    // comentário — o estado dos agendamentos nunca fecha o fluxo por si só.
    // Só os botões de conclusão de etapa o exigem.

    const novoEstado =
      decisao === 'rejeitado'
        ? 'rejeitado'
        : etapa === 'supervisor'
          ? 'aprovado_supervisor'
          : 'aprovado_dlab';

    const nova = await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({ where: { id: ag.id }, data: { estado: novoEstado } });
      return tx.aprovacao.create({
        data: {
          agendamento_id: ag.id,
          actividade_id: act.id,
          aprovador_id: req.user.id,
          etapa,
          decisao,
          comentario: texto || null,
          decidido_em: new Date(),
        },
        include: APROVACAO_INCLUDE,
      });
    });
    res.status(201).json(toAprovacaoGet(nova));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/lote — decisão EM MASSA sobre vários agendamentos da mesma
// atividade numa única aprovação (PLANO.md §2.8). Comentário único opcional.
// Body: { actividadades_etapa..., itens: [{ agendamento_id, decisao }] }
// Estrutura: { etapa, itens: [{ agendamento_id, decisao }], comentario? }
fila.post('/lote', async (req, res, next) => {
  try {
    const { etapa, itens, comentario } = req.body || {};
    if (!etapa || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ message: 'etapa e itens são obrigatórios' });
    }
    if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });
    if (!(await podeVotarEtapa(etapa, req.user.tipo))) {
      return res.status(403).json({ message: 'Não está autorizado a votar nesta etapa' });
    }
    if (itens.length > 50) return res.status(400).json({ message: 'Máximo de 50 agendamentos por lote' });
    const texto = (comentario || '').trim();

    const ids = itens.map((i) => Number(i.agendamento_id));
    if (ids.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ message: 'agendamento_id inválido' });
    }
    for (const item of itens) {
      if (!['aprovado', 'rejeitado'].includes(item.decisao)) {
        return res.status(400).json({ message: 'decisao inválida (aprovado | rejeitado)' });
      }
    }

    const ags = await prisma.agendamento.findMany({
      where: { id: { in: ids }, activo: true },
      include: { actividade: true },
    });
    if (ags.length !== ids.length) return res.status(404).json({ message: 'Um ou mais agendamentos não existem' });

    const act = ags[0].actividade;
    if (ags.some((a) => a.actividade_id !== act.id)) {
      return res.status(400).json({ message: 'Os agendamentos têm de pertencer à mesma atividade' });
    }
    if (!act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // Validações de sequência (mesmas do voto individual)
    for (const ag of ags) {
      if (etapa === 'dlab') {
        if (act.estado !== 'pendente') {
          return res.status(409).json({ message: 'A atividade já não está na fase de revisão do DLab' });
        }
        if (ag.estado !== 'nao_revisto') {
          return res.status(409).json({ message: `Agendamento ${ag.id} já foi decidido ou deixado pendente pelo DLab` });
        }
      } else {
        if (act.estado !== 'revisado_dlab') {
          return res.status(409).json({ message: 'A atividade ainda não concluiu a revisão do DLab' });
        }
        if (ag.estado !== 'aprovado_dlab' && ag.estado !== 'pendente') {
          return res.status(409).json({ message: `Agendamento ${ag.id} já foi decidido pelo Supervisor` });
        }
      }
    }

    const decisaoLote = itens.every((i) => i.decisao === 'aprovado') ? 'aprovado' : 'rejeitado';

    const nova = await prisma.$transaction(async (tx) => {
      const ap = await tx.aprovacao.create({
        data: {
          agendamento_id: null,
          actividade_id: act.id,
          aprovador_id: req.user.id,
          etapa,
          decisao: decisaoLote,
          comentario: texto || null,
          decidido_em: new Date(),
        },
        include: APROVACAO_INCLUDE,
      });
      for (const item of itens) {
        const ag = ags.find((a) => a.id === Number(item.agendamento_id));
        const novoEstado =
          item.decisao === 'rejeitado'
            ? 'rejeitado'
            : etapa === 'supervisor'
              ? 'aprovado_supervisor'
              : 'aprovado_dlab';
        await tx.agendamento.update({ where: { id: ag.id }, data: { estado: novoEstado } });
        await tx.aprovacaoAgendamento.create({
          data: { aprovacao_id: ap.id, agendamento_id: ag.id, decisao: item.decisao },
        });
      }
      return ap;
    });
    res.status(201).json(toAprovacaoGet(nova));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/pendente — "Deixar pendente" (apenas etapa DLab): coloca o
// agendamento em estado pendente (decisão adiada deliberadamente).
// Body: { agendamento_id }
fila.post('/pendente', async (req, res, next) => {
  try {
    const { agendamento_id } = req.body || {};
    if (!agendamento_id) return res.status(400).json({ message: 'agendamento_id é obrigatório' });
    if (!(await podeVotarEtapa('dlab', req.user.tipo))) {
      return res.status(403).json({ message: 'Não está autorizado a deixar agendamentos pendentes' });
    }

    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(agendamento_id) },
      include: { actividade: true },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    const act = ag.actividade;
    if (!act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    if (act.estado !== 'pendente') {
      return res.status(409).json({ message: 'A atividade já não está na fase de revisão do DLab' });
    }
    if (ag.estado !== 'nao_revisto') {
      return res.status(409).json({ message: 'Este agendamento já foi decidido ou deixado pendente' });
    }

    await prisma.agendamento.update({ where: { id: ag.id }, data: { estado: 'pendente' } });
    res.status(200).json({ message: 'Agendamento deixado pendente' });
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/rollback — reverte a decisão individual de um agendamento,
// devolvendo-o ao estado anterior (volta a ficar votável na sessão).
// Body: { agendamento_id, etapa }
fila.post('/rollback', async (req, res, next) => {
  try {
    const { agendamento_id, etapa } = req.body || {};
    if (!agendamento_id || !etapa) {
      return res.status(400).json({ message: 'agendamento_id e etapa são obrigatórios' });
    }
    if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });

    const ag = await prisma.agendamento.findUnique({
      where: { id: Number(agendamento_id) },
      include: { actividade: true },
    });
    if (!ag || !ag.activo) return res.status(404).json({ message: 'Agendamento não encontrado' });
    const act = ag.actividade;
    if (!act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    if (etapa === 'dlab' && !(await podeVotarEtapa('dlab', req.user.tipo))) {
      return res.status(403).json({ message: 'Só o Coordenador DLab ou o Admin podem reverter decisões desta etapa' });
    }
    if (etapa === 'supervisor' && !(await podeVotarEtapa('supervisor', req.user.tipo))) {
      return res.status(403).json({ message: 'Só o Supervisor ou o Admin podem reverter decisões desta etapa' });
    }
    if (etapa === 'dlab' && act.estado !== 'pendente') {
      return res.status(409).json({ message: 'A atividade já saiu da fase de revisão do DLab' });
    }
    if (etapa === 'supervisor' && act.estado !== 'revisado_dlab') {
      return res.status(409).json({ message: 'A atividade já não está em revisão do Supervisor' });
    }

    const ap = await prisma.aprovacao.findFirst({
      where: {
        activo: true,
        etapa,
        OR: [
          { agendamento_id: ag.id },
          { aprovacaoAgendamentos: { some: { activo: true, agendamento_id: ag.id } } },
        ],
      },
      orderBy: { id: 'desc' },
      include: { aprovacaoAgendamentos: true },
    });

    // Estado anterior: etapa DLab → volta a nao_revisto; etapa Supervisor →
    // volta a aprovado_dlab (se o DLab aprovou) ou a pendente (se adiado).
    if (!ap) {
      // Sem registo de aprovação: só pode ser um "Deixar pendente" do DLab
      // (a ação não cria aprovação — há apenas o estado do agendamento).
      if (etapa === 'dlab' && ag.estado === 'pendente') {
        await prisma.agendamento.update({ where: { id: ag.id }, data: { estado: 'nao_revisto' } });
        return res.json({ message: 'Decisão revertida', estado: 'nao_revisto' });
      }
      return res.status(409).json({ message: 'Não existe uma decisão para reverter' });
    }

    const dlabAprovado = await prisma.aprovacaoAgendamento.findFirst({
      where: {
        activo: true,
        agendamento_id: ag.id,
        decisao: 'aprovado',
        aprovacao: { etapa: 'dlab', activo: true },
      },
    });
    const anterior =
      etapa === 'dlab'
        ? 'nao_revisto'
        : dlabAprovado
          ? 'aprovado_dlab'
          : 'pendente';

    await prisma.$transaction(async (tx) => {
      // Voto individual: desativa a aprovação. Voto em lote: remove só este
      // agendamento do lote; se o lote ficar vazio, desativa-o também.
      if (ap.agendamento_id != null) {
        await tx.aprovacao.update({ where: { id: ap.id }, data: { activo: false } });
      } else {
        await tx.aprovacaoAgendamento.updateMany({
          where: { aprovacao_id: ap.id, agendamento_id: ag.id, activo: true },
          data: { activo: false },
        });
        const restantes = await tx.aprovacaoAgendamento.count({
          where: { aprovacao_id: ap.id, activo: true },
        });
        if (restantes === 0) {
          await tx.aprovacao.update({ where: { id: ap.id }, data: { activo: false } });
        }
      }
      await tx.agendamento.update({ where: { id: ag.id }, data: { estado: anterior } });
    });
    res.json({ message: 'Decisão revertida', estado: anterior });
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/:id/finalizar — concluir a revisão da etapa atual da atividade.
// DLab: pendente → revisado_dlab; Supervisor: revisado_dlab → revisado_supervisor.
// Se TODOS os agendamentos estiverem rejeitados, a atividade é rejeitada no ato
// (mesmo resultado do "Rejeitar atividade"), em qualquer etapa.
// Body: { comentario } (obrigatório — comentário/parecer da sessão de revisão)
fila.post('/:id/finalizar', async (req, res, next) => {
  try {
    const { comentario } = req.body || {};
    const texto = (comentario || '').trim();
    if (!texto) {
      return res.status(400).json({ message: 'O comentário é obrigatório ao concluir esta etapa' });
    }

    const act = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    let etapa;
    if (req.user.tipo === 'supervisor') etapa = 'supervisor';
    else if (req.user.tipo === 'coordenador_dlab') etapa = 'dlab';
    else etapa = act.estado === 'revisado_dlab' ? 'supervisor' : 'dlab'; // admin decide pelo estado

    // Conclusão de etapa com TODOS os agendamentos rejeitados: a atividade é
    // rejeitada aqui mesmo (mesmo resultado do "Rejeitar atividade"). O estado
    // dos agendamentos nunca fecha o fluxo por si só — só estes botões o fazem.
    const totalAg = await prisma.agendamento.count({ where: { activo: true, actividade_id: act.id } });
    const rejeitados = await prisma.agendamento.count({
      where: { activo: true, actividade_id: act.id, estado: 'rejeitado' },
    });
    const todosRejeitados = totalAg > 0 && rejeitados === totalAg;

    if (todosRejeitados) {
      if (etapa === 'dlab' && act.estado !== 'pendente') {
        return res.status(409).json({ message: 'A atividade não está pendente (fase DLab já concluída)' });
      }
      if (etapa === 'supervisor' && act.estado !== 'revisado_dlab') {
        return res.status(409).json({ message: 'A atividade ainda não concluiu a revisão do DLab' });
      }
      const atualizado = await prisma.$transaction(async (tx) => {
        const up = await tx.actividade.update({ where: { id: act.id }, data: { estado: 'rejeitado' } });
        await tx.aprovacao.create({
          data: {
            agendamento_id: null,
            actividade_id: act.id,
            aprovador_id: req.user.id,
            etapa,
            decisao: 'rejeitado',
            comentario: texto,
            decidido_em: new Date(),
          },
        });
        return up;
      });
      return res.json({
        message: 'Todos os agendamentos foram rejeitados — a atividade foi rejeitada',
        estado: atualizado.estado,
      });
    }

    let novoEstado;
    if (etapa === 'dlab') {
      if (act.estado !== 'pendente') {
        return res.status(409).json({ message: 'A atividade não está pendente (fase DLab já concluída)' });
      }
      // Etapa 1: ninguém pode ficar em nao_revisto (todos foram revistos ou deixados pendentes)
      const porRevistar = await prisma.agendamento.count({
        where: { activo: true, actividade_id: act.id, estado: 'nao_revisto' },
      });
      if (porRevistar > 0) {
        return res.status(409).json({
          message: `Ainda existem ${porRevistar} agendamento(s) por revisar nesta etapa`,
        });
      }
      novoEstado = 'revisado_dlab';
    } else {
      if (act.estado !== 'revisado_dlab') {
        return res.status(409).json({ message: 'A atividade ainda não concluiu a revisão do DLab' });
      }
      // E0.5 — "Pendentes não bloqueiam avanço": a aprovação final conclui mesmo
      // com agendamentos ainda não decididos; só os aprovado_supervisor e
      // rejeitados é que ficam resolvidos — os restantes não entram no calendário.
      // Técnico validador obrigatório (verificado apenas na conclusão — bug 1.4)
      const temValidador = await prisma.actividadeTecnico.count({
        where: { activo: true, actividade_id: act.id, papel: 'validador' },
      });
      if (temValidador === 0) {
        return res.status(409).json({ message: 'É necessário atribuir um Técnico (Validador) antes de concluir a aprovação final' });
      }
      novoEstado = 'revisado_supervisor';
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const up = await tx.actividade.update({ where: { id: act.id }, data: { estado: novoEstado } });
      await tx.aprovacao.create({
        data: {
          agendamento_id: null,
          actividade_id: act.id,
          aprovador_id: req.user.id,
          etapa,
          decisao: 'aprovado',
          comentario: texto,
          decidido_em: new Date(),
        },
      });
      return up;
    });
    res.json({ message: 'Revisão concluída', estado: actualizado.estado });
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/:id/rejeitar — rejeição explícita de toda a atividade (RF11).
// Exige apenas o comentário/parecer (a justificação).
fila.post('/:id/rejeitar', async (req, res, next) => {
  try {
    const { comentario } = req.body || {};
    if (!comentario || !comentario.trim()) {
      return res.status(400).json({ message: 'A justificação é obrigatória ao rejeitar a atividade' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    if (act.estado === 'rejeitado') return res.status(409).json({ message: 'A atividade já está rejeitada' });
    if (act.estado === 'revisado_supervisor') return res.status(409).json({ message: 'A revisão final já foi concluída' });

    const etapa = act.estado === 'revisado_dlab' ? 'supervisor' : 'dlab';
    if (!(await podeVotarEtapa(etapa, req.user.tipo))) {
      return res.status(403).json({ message: 'Não está autorizado a rejeitar nesta fase' });
    }

    const nova = await prisma.$transaction(async (tx) => {
      await tx.actividade.update({ where: { id: act.id }, data: { estado: 'rejeitado' } });
      // Rejeitar a atividade rejeita em cascata todos os agendamentos
      await tx.agendamento.updateMany({
        where: { activo: true, actividade_id: act.id },
        data: { estado: 'rejeitado' },
      });
      return tx.aprovacao.create({
        data: {
          agendamento_id: null,
          actividade_id: act.id,
          aprovador_id: req.user.id,
          etapa,
          decisao: 'rejeitado',
          comentario,
          decidido_em: new Date(),
        },
        include: APROVACAO_INCLUDE,
      });
    });
    res.status(201).json(toAprovacaoGet(nova));
  } catch (err) {
    next(err);
  }
});

export default fila;

// GET /actividades/:id/aprovacoes — histórico de aprovações da atividade
export const historico = (() => {
  const r = Router();
  r.use(authRequired);
  r.get('/:id/aprovacoes', async (req, res, next) => {
    try {
      const rows = await prisma.aprovacao.findMany({
        where: {
          activo: true,
          OR: [
            { actividade_id: Number(req.params.id) },
            { agendamento: { is: { actividade_id: Number(req.params.id) } } },
            { aprovacaoAgendamentos: { some: { agendamento: { is: { actividade_id: Number(req.params.id) } } } } },
          ],
        },
        include: APROVACAO_INCLUDE,
        orderBy: { id: 'asc' },
      });
      res.json(rows.map(toAprovacaoGet));
    } catch (err) {
      next(err);
    }
  });
  return r;
})();