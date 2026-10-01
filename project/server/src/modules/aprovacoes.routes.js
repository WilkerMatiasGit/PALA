import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toDecisaoGet } from '../utils/dto.js';
import { podeVotarEtapa } from '../utils/fluxo.js';
import { recalcularEstadoActividade } from '../utils/actividade_estado.js';

// Fila principal /aprovacoes — modelo POR AGENDAMENTO (agendamentos independentes).
const fila = Router();
fila.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'));

// Estados que ficam "em espera" de cada etapa.
const ESTADOS_ESPERA = {
  dlab: ['nao_revisto'],
  supervisor: ['aprovado_dlab', 'pendente'],
};

// Etapa à qual um agendamento está sujeito neste momento (null se já decidido).
function etapaDeAgendamento(estado) {
  if (estado === 'nao_revisto') return 'dlab';
  if (estado === 'aprovado_dlab' || estado === 'pendente') return 'supervisor';
  return null;
}

// Rejeição da atividade inteira (shutdown). Não depende do papel, apenas do estado
// das sessões e da permissão de etapa do utilizador:
//  - bloqueio: alguma sessão realizada, alguma em aprovado_supervisor (topo do fluxo)
//    ou todas as sessões já rejeitadas;
//  - habilitação: todas as sessões não-rejeitadas na MESMA etapa e o utilizador
//    com permissão para decidir nessa etapa (via FluxoAprovacao).
async function podeRejeitarAtividade(agendamentos, tipo) {
  if (agendamentos.length === 0) return false;
  if (agendamentos.some((g) => g.realizado)) return false;
  if (agendamentos.some((g) => g.estado === 'aprovado_supervisor')) return false;
  const naoRejeitados = agendamentos.filter((g) => g.estado !== 'rejeitado');
  if (naoRejeitados.length === 0) return false;
  const etapas = new Set(naoRejeitados.map((g) => etapaDeAgendamento(g.estado)));
  if (etapas.size !== 1) return false;
  const [etapa] = etapas;
  if (!etapa) return false;
  return podeVotarEtapa(etapa, tipo);
}

// Validação comum dos técnicos (validador + assistente) pedidos na aprovação do
// Supervisor. Ambos são obrigatórios e podem ser a mesma pessoa.
async function validarTecnicos(tecnicos) {
  const validadorId = Number(tecnicos?.validador_id);
  const assistenteId = Number(tecnicos?.assistente_id);
  if (!Number.isInteger(validadorId) || !Number.isInteger(assistenteId)) {
    return { error: 'É obrigatório indicar o técnico validador e o técnico assistente' };
  }
  const users = await prisma.utilizador.findMany({
    where: { id: { in: [validadorId, assistenteId] }, activo: true, tipo: 'tecnico' },
    select: { id: true, nome: true, tipo: true },
  });
  const encontrados = new Set(users.map((u) => u.id));
  if (!encontrados.has(validadorId) || !encontrados.has(assistenteId)) {
    return { error: 'O técnico validador/assistente tem de ser um utilizador ativo com o papel técnico' };
  }
  return { validador_id: validadorId, assistente_id: assistenteId };
}

// GET /aprovacoes — fila adaptativa via FluxoAprovacao (RF09/RF10).
// Agrupa por atividade os agendamentos que ainda estão em espera para o utilizador.
// leitor (chefe_departamento) vê a fila do DLab; admin vê as duas.
fila.get('/', async (req, res, next) => {
  try {
    const tipo = req.user.tipo;
    const podeDlab = await podeVotarEtapa('dlab', tipo);
    const podeSup = await podeVotarEtapa('supervisor', tipo);

    const estados = new Set();
    if (podeDlab || !podeSup) ESTADOS_ESPERA.dlab.forEach((s) => estados.add(s));
    if (podeSup) ESTADOS_ESPERA.supervisor.forEach((s) => estados.add(s));

    const ags = await prisma.agendamento.findMany({
      where: {
        activo: true,
        estado: { in: [...estados] },
        actividade: { activo: true },
      },
      include: { actividade: { select: { id: true, nome: true, estado: true, criado_em: true } } },
      orderBy: { id: 'asc' },
    });

    const porAct = new Map();
    for (const g of ags) {
      const a = g.actividade;
      if (!porAct.has(a.id)) {
        porAct.set(a.id, { id: a.id, nome: a.nome, estado: a.estado, criado_em: a.criado_em, em_espera: 0 });
      }
      porAct.get(a.id).em_espera += 1;
    }
    res.json([...porAct.values()]);
  } catch (err) {
    next(err);
  }
});

// GET /aprovacoes/:id — :id é o actividad_id. Devolve a atividade + agendamentos
// com as respetivas decisões e a informação de quem pode decidir cada um.
fila.get('/:id', async (req, res, next) => {
  try {
    const act = await prisma.actividade.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        laboratorio: true,
        responsavel: true,
        criado_por: true,
        agendamentos: {
          where: { activo: true },
          include: {
            decisoes: { include: { decisor: true }, orderBy: { id: 'asc' } },
            tecnicos: { where: { activo: true }, include: { utilizador: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    const agendamentos = [];
    for (const g of act.agendamentos) {
      const etapaAlvo = etapaDeAgendamento(g.estado);
      const podeDecidir = etapaAlvo ? await podeVotarEtapa(etapaAlvo, req.user.tipo) : false;
      const val = g.tecnicos.find((t) => t.papel === 'validador');
      const ass = g.tecnicos.find((t) => t.papel === 'assistente');
      agendamentos.push({
        id: g.id,
        num_participantes: g.num_participantes,
        hora_inicio: g.hora_inicio,
        hora_fim: g.hora_fim,
        estado: g.estado,
        realizado: g.realizado,
        confirmado_professor_em: g.confirmado_professor_em,
        confirmado_tecnico_em: g.confirmado_tecnico_em,
        etapa_alvo: etapaAlvo,
        pode_decidir: podeDecidir,
        decisoes: g.decisoes.map(toDecisaoGet),
        validador_id: val?.utilizador_id ?? null,
        validador_nome: val?.utilizador?.nome ?? '',
        assistente_id: ass?.utilizador_id ?? null,
        assistente_nome: ass?.utilizador?.nome ?? '',
      });
    }

    res.json({
      id: act.id,
      nome: act.nome,
      tipo: act.tipo,
      estado: act.estado,
      pode_rejeitar_atividade: await podeRejeitarAtividade(act.agendamentos, req.user.tipo),
      laboratorio_id: act.laboratorio_id,
      laboratorio_nome: act.laboratorio?.nome ?? '',
      responsavel_id: act.responsavel_id,
      responsavel_nome: act.responsavel?.nome ?? '',
      criado_por_nome: act.criado_por?.nome ?? '',
      observacoes: act.observacoes ?? '',
      criado_em: act.criado_em,
      actualizado_em: act.actualizado_em,
      agendamentos,
    });
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes — voto INDIVIDUAL por agendamento.
// Body: { agendamento_id, etapa, decisao, comentario?, tecnicos?: { validador_id, assistente_id } }
//  - DLab: Aprovar/Rejeitar (rejeição exige justificação).
//  - Supervisor Aprovar: OBRIGA a indicar o par validador+assistente; grava tudo
//    atomicamente (decisão + 2 linhas AgendamentoTecnico + estado da sessão).
//  - Supervisor Rejeitar: sem técnicos (justificação obrigatória).
// A primeira decisão de um agendamento da atividade muda o estado para em_andamento;
// no fim, o estado da atividade é derivado das sessões.
fila.post('/', async (req, res, next) => {
  try {
    const { agendamento_id, etapa, decisao, comentario, tecnicos } = req.body || {};
    if (!agendamento_id || !etapa || !decisao) {
      return res.status(400).json({ message: 'agendamento_id, etapa e decisao são obrigatórios' });
    }
    if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });
    if (!['aprovado', 'rejeitado'].includes(decisao)) return res.status(400).json({ message: 'decisao inválida' });
    const texto = (comentario || '').trim();
    if (decisao === 'rejeitado' && !texto) {
      return res.status(400).json({ message: 'A justificação é obrigatória ao rejeitar um agendamento' });
    }

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

    // Validação de sequência: o agendamento tem de estar em espera nesta etapa
    if (!ESTADOS_ESPERA[etapa].includes(ag.estado)) {
      return res.status(409).json({ message: 'Este agendamento já não está em espera nesta etapa' });
    }

    // Supervisor a aprovar exige o par de técnicos (grava-se na mesma transação).
    let tecnicosValidados = null;
    if (etapa === 'supervisor' && decisao === 'aprovado') {
      const r = await validarTecnicos(tecnicos);
      if (r.error) return res.status(400).json({ message: r.error });
      const jaTem = await prisma.agendamentoTecnico.findFirst({
        where: { agendamento_id: ag.id, activo: true },
        select: { id: true },
      });
      if (jaTem) {
        return res.status(409).json({ message: 'Este agendamento já tem técnicos atribuídos' });
      }
      tecnicosValidados = r;
    }

    const novoEstado =
      decisao === 'rejeitado'
        ? 'rejeitado'
        : etapa === 'supervisor'
          ? 'aprovado_supervisor'
          : 'aprovado_dlab';

    const nova = await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({ where: { id: ag.id }, data: { estado: novoEstado } });
      const dec = await tx.decisaoAgendamento.create({
        data: {
          agendamento_id: ag.id,
          decisor_id: req.user.id,
          etapa,
          decisao,
          comentario: texto || null,
        },
        include: { decisor: true, agendamento: { include: { actividade: { select: { nome: true } } } } },
      });
      if (tecnicosValidados) {
        await tx.agendamentoTecnico.createMany({
          data: [
            { agendamento_id: ag.id, utilizador_id: tecnicosValidados.validador_id, papel: 'validador' },
            { agendamento_id: ag.id, utilizador_id: tecnicosValidados.assistente_id, papel: 'assistente' },
          ],
        });
      }
      await recalcularEstadoActividade(tx, act.id);
      return dec;
    });
    res.status(201).json(toDecisaoGet(nova));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/lote — decisão EM MASSA sobre vários agendamentos da mesma
// atividade (PLANO.md §2.8). A etapa de cada agendamento é derivada do estado,
// por isso o pedido NÃO leva etapa. Comentário único opcional — obrigatório se
// algum agendamento do lote for rejeitado.
// Supervisor: só é permitido REJEITAR em massa (aprovar exige selecionar técnicos
// por sessão — fazer individualmente). DLab: aprovar/rejeitar.
// Body: { itens: [{ agendamento_id, decisao }], comentario? }
fila.post('/lote', async (req, res, next) => {
  try {
    const { itens, comentario } = req.body || {};
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ message: 'itens são obrigatórios' });
    }
    if (itens.length > 50) return res.status(400).json({ message: 'Máximo de 50 agendamentos por lote' });
    const texto = (comentario || '').trim();

    const ids = [];
    const decisaoPorId = new Map();
    for (const item of itens) {
      const id = Number(item?.agendamento_id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'agendamento_id inválido' });
      if (!['aprovado', 'rejeitado'].includes(item.decisao)) {
        return res.status(400).json({ message: 'decisao inválida (aprovado | rejeitado)' });
      }
      ids.push(id);
      decisaoPorId.set(id, item.decisao);
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

    // Deriva a etapa de cada agendamento e valida a sequência
    const etapas = new Set();
    const aprovSupervisor = [];
    for (const ag of ags) {
      const etapa = etapaDeAgendamento(ag.estado);
      if (!etapa) {
        return res.status(409).json({ message: `Agendamento ${ag.id} já não está em espera (estado ${ag.estado})` });
      }
      etapas.add(etapa);
      if (etapa === 'supervisor' && decisaoPorId.get(ag.id) === 'aprovado') aprovSupervisor.push(ag.id);
    }
    if (aprovSupervisor.length > 0) {
      return res.status(400).json({
        message: `Aprovar em massa na etapa do Supervisor exige selecionar técnicos por sessão (agendamentos ${aprovSupervisor.join(', ')}). Faça a aprovação individual.`,
      });
    }
    for (const e of etapas) {
      if (!(await podeVotarEtapa(e, req.user.tipo))) {
        return res.status(403).json({ message: 'Não está autorizado a votar numa das etapas do lote' });
      }
    }
    const temRejeicao = itens.some((i) => i.decisao === 'rejeitado');
    if (temRejeicao && !texto) {
      return res.status(400).json({ message: 'A justificação é obrigatória quando o lote rejeita agendamentos' });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const ag of ags) {
        const etapa = etapaDeAgendamento(ag.estado);
        const decisao = decisaoPorId.get(ag.id);
        const novoEstado =
          decisao === 'rejeitado'
            ? 'rejeitado'
            : etapa === 'supervisor'
              ? 'aprovado_supervisor'
              : 'aprovado_dlab';
        await tx.agendamento.update({ where: { id: ag.id }, data: { estado: novoEstado } });
        const dec = await tx.decisaoAgendamento.create({
          data: {
            agendamento_id: ag.id,
            decisor_id: req.user.id,
            etapa,
            decisao,
            comentario: texto || null,
          },
          include: { decisor: true, agendamento: { include: { actividade: { select: { nome: true } } } } },
        });
        out.push(dec);
      }
      await recalcularEstadoActividade(tx, act.id);
      return out;
    });
    res.status(201).json(resultado.map(toDecisaoGet));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/pendente — "Deixar pendente" (apenas etapa DLab): coloca o
// agendamento em estado pendente (decisão adiada deliberadamente). NÃO cria
// DecisaoAgendamento (logo não dispara a passagem da atividade para em_andamento).
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
    if (ag.estado !== 'nao_revisto') {
      return res.status(409).json({ message: 'Este agendamento já foi decidido ou deixado pendente' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.agendamento.update({ where: { id: ag.id }, data: { estado: 'pendente' } });
      await recalcularEstadoActividade(tx, act.id);
    });
    res.status(200).json({ message: 'Agendamento deixado pendente' });
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes/:id/rejeitar — rejeição explícita de toda a atividade (RF11).
// Só é possível quando nenhuma sessão está aprovada pelo Supervisor nem realizada;
// caso contrário devolve um erro claro e pede rejeição individual das pendentes.
// Rejeita (com justificação) todos os agendamentos ainda em espera e força o
// estado da atividade para 'rejeitada'.
fila.post('/:id/rejeitar', async (req, res, next) => {
  try {
    const { comentario } = req.body || {};
    const texto = (comentario || '').trim();
    if (!texto) {
      return res.status(400).json({ message: 'A justificação é obrigatória ao rejeitar a atividade' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!act || !act.activo) {
      return res.status(404).json({ message: 'Atividade não encontrada' });
    }

    const ags = await prisma.agendamento.findMany({
      where: { activo: true, actividade_id: act.id },
      select: { id: true, estado: true, realizado: true },
    });

    // Bloqueio (decisão do utilizador): não rejeitar se já existirem sessões
    // aprovadas ou realizadas.
    const intocaveis = ags.filter((g) => g.estado === 'aprovado_supervisor' || g.realizado);
    if (intocaveis.length > 0) {
      return res.status(409).json({
        message:
          'Não é possível rejeitar a atividade porque já tem sessões aprovadas ou realizadas. Rejeite as sessões pendentes individualmente.',
      });
    }

    const alvo = ags.filter((g) => etapaDeAgendamento(g.estado) != null);
    if (alvo.length === 0) {
      return res.status(409).json({ message: 'A atividade não tem agendamentos em espera para rejeitar' });
    }

    const etapas = [...new Set(alvo.map((g) => etapaDeAgendamento(g.estado)))];
    let autorizado = false;
    for (const e of etapas) {
      if (await podeVotarEtapa(e, req.user.tipo)) autorizado = true;
    }
    if (!autorizado) {
      return res.status(403).json({ message: 'Não está autorizado a rejeitar nesta fase' });
    }

    await prisma.$transaction(async (tx) => {
      for (const g of alvo) {
        const etapa = etapaDeAgendamento(g.estado);
        await tx.agendamento.update({ where: { id: g.id }, data: { estado: 'rejeitado' } });
        await tx.decisaoAgendamento.create({
          data: { agendamento_id: g.id, decisor_id: req.user.id, etapa, decisao: 'rejeitado', comentario: texto },
        });
      }
      await tx.actividade.update({ where: { id: act.id }, data: { estado: 'rejeitada' } });
    });
    res.json({ message: 'Atividade rejeitada', rejeitados: alvo.length });
  } catch (err) {
    next(err);
  }
});

export default fila;

// GET /actividades/:id/decisoes — histórico de decisões da atividade (por agendamento).
export const historico = (() => {
  const r = Router();
  r.use(authRequired);
  r.get('/:id/decisoes', async (req, res, next) => {
    try {
      const ags = await prisma.agendamento.findMany({
        where: { activo: true, actividade_id: Number(req.params.id) },
        select: { id: true },
      });
      const ids = ags.map((g) => g.id);
      let rows = [];
      if (ids.length > 0) {
        rows = await prisma.decisaoAgendamento.findMany({
          where: { agendamento_id: { in: ids } },
          include: {
            decisor: true,
            agendamento: { include: { actividade: { select: { nome: true } } } },
          },
          orderBy: { id: 'asc' },
        });
      }
      res.json(rows.map(toDecisaoGet));
    } catch (err) {
      next(err);
    }
  });
  return r;
})();