import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import {
  toActividadeGet,
  toAulaGet,
  toVisitaGet,
  toProjectoGet,
  toEstagioGet,
  toAgendamentoMaterialGet,
  toAgendamentoGet,
} from '../utils/dto.js';
import { validarSessao } from '../utils/validarSessao.js';
import { obterConfiguracaoGeral } from '../utils/configuracao.js';
import {
  podeAlterarActividade,
  alterarComPermissao,
  flagsActividade,
} from '../utils/actividade_permissao.js';

const router = Router();
router.use(authRequired);
const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const actInclude = { criado_por: true, responsavel: true, laboratorio: true };

// include das listagens/detalhe: junta a contagem de sessões activas já revistas
// (com decisão) para calcular `pode_editar`/`pode_apagar` sem N consultas.
const actIncludeFlags = {
  ...actInclude,
  _count: { select: { agendamentos: { where: { activo: true, decisoes: { some: {} } } } } },
};

// Regra de responsabilidade:
//  - o autor (criado_por_id) é sempre o utilizador autenticado;
//  - se o utilizador for Professor, criado_por_id = responsavel_id = o próprio;
//  - caso contrário (admin/coord/supervisor/chefe), o responsável é o indicado (default: próprio).
//  - o responsável tem de ser o próprio utilizador ou um Professor; para "aula", tem de ser Professor.
async function resolverResponsavel(req, body, tipo) {
  if (req.user.tipo === 'professor') return req.user.id;
  const id = body.responsavel_id != null ? Number(body.responsavel_id) : req.user.id;
  const u = await prisma.utilizador.findUnique({ where: { id } });
  if (!u || !u.activo) {
    throw HTTP(400, 'Utilizador responsável inválido');
  }
  const ehProprio = u.id === req.user.id;
  const ehProfessor = u.tipo === 'professor';
  if (tipo === 'aula') {
    if (!ehProfessor) throw HTTP(400, 'Para o tipo "aula", o responsável tem de ser um professor');
  } else if (!(ehProprio || ehProfessor)) {
    throw HTTP(400, 'O responsável deve ser o próprio utilizador ou um professor');
  }
  return u.id;
}

// ---- CRUD Actividades ----

// GET /actividades — listar (filtros tipo, estado, lab, visibilidade por role)
router.get('/', async (req, res, next) => {
  try {
    const where = { activo: true };
    if (req.query.tipo) where.tipo = req.query.tipo;
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.laboratorio_id) where.laboratorio_id = Number(req.query.laboratorio_id);
    if (req.user.tipo === 'professor') {
      where.responsavel_id = req.user.id;
    } else if (req.user.tipo === 'tecnico') {
      where.agendamentos = { some: { activo: true, tecnicos: { some: { activo: true, utilizador_id: req.user.id } } } };
    }
    const rows = await prisma.actividade.findMany({ where, include: actIncludeFlags, orderBy: { criado_em: 'desc' } });
    res.json(rows.map((a) => toActividadeGet(a, flagsActividade(a, req.user, a._count.agendamentos > 0))));
  } catch (err) {
    next(err);
  }
});

// GET /actividades/:id
router.get('/:id', async (req, res, next) => {
  try {
    const a = await prisma.actividade.findFirst({ where: { id: Number(req.params.id), activo: true }, include: actIncludeFlags });
    if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
    res.json(toActividadeGet(a, flagsActividade(a, req.user, a._count.agendamentos > 0)));
  } catch (err) {
    next(err);
  }
});

// POST /actividades — criar
router.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { nome, responsavel_id, laboratorio_id, observacoes, tipo } = req.body || {};
    if (!nome || !laboratorio_id || !tipo) {
      return res.status(400).json({ message: 'nome, laboratorio_id e tipo são obrigatórios' });
    }
    const respId = await resolverResponsavel(req, { responsavel_id }, tipo);
    const novo = await prisma.actividade.create({
      data: {
        nome,
        criado_por_id: req.user.id,
        responsavel_id: respId,
        laboratorio_id: Number(laboratorio_id),
        tipo,
        estado: 'pendente',
        observacoes: observacoes || '',
      },
      include: actInclude,
    });
    res.status(201).json(toActividadeGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /actividades/:id
router.put('/:id', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const a = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!a || !a.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // Regras 1 (estado) + 2 (autoria): só o responsável/Admin, e só sem sessões revistas.
    const perm = await podeAlterarActividade(a, req.user);
    if (!perm.ok) return res.status(perm.status).json({ message: perm.motivo });

    const { nome, responsavel_id, laboratorio_id, observacoes, tipo } = req.body || {};

    // Regra 3: tipo e laboratório são imutáveis (mesmo para o Admin). Aceita-se
    // reenviar o valor actual; qualquer alteração é rejeitada com 400.
    if (tipo !== undefined && tipo !== a.tipo) {
      return res.status(400).json({ message: 'O tipo de uma atividade não pode ser alterado.' });
    }
    if (laboratorio_id !== undefined && Number(laboratorio_id) !== a.laboratorio_id) {
      return res.status(400).json({ message: 'O laboratório de uma atividade não pode ser alterado.' });
    }

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (observacoes !== undefined) data.observacoes = observacoes;
    // Regra 3: só o Admin altera o responsável; para os restantes, aceitar só o valor actual.
    if (responsavel_id !== undefined) {
      if (req.user.tipo === 'admin') {
        data.responsavel_id = await resolverResponsavel(req, { responsavel_id }, a.tipo);
      } else if (Number(responsavel_id) !== a.responsavel_id) {
        return res.status(400).json({ message: 'Apenas um administrador pode alterar o responsável pela atividade.' });
      }
    }

    const atualizado = await alterarComPermissao(a, req.user, (tx) =>
      tx.actividade.update({ where: { id: a.id }, data, include: actInclude }),
    );
    res.json(toActividadeGet(atualizado));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

// ---- Criação/edição atómica (atividade + detalhes + agendamentos + materiais) ----

const HTTP = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

// Constrói a especialização conforme o tipo; devolve null se faltarem campos obrigatórios
function montarDetalhes(tipo, det) {
  const d = det || {};
  switch (tipo) {
    case 'aula': {
      if (d.curso_disciplina_id == null) return null;
      const turno = d.turno === 'manha' || d.turno === 'tarde' ? d.turno : null;
      const num = Number(d.numero_turma);
      return {
        curso_disciplina_id: Number(d.curso_disciplina_id),
        tema: d.tema || '',
        turno,
        numero_turma: Number.isInteger(num) && num > 0 ? num : null,
      };
    }
    case 'visita': {
      const tel = String(d.telefone || '').replace(/\s/g, '');
      if (!d.nome_visitante || !tel || !d.email) return null;
      if (!/^[0-9]{9}$/.test(tel)) return 'TELEFONE_INVALIDO';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email))) return 'EMAIL_INVALIDO';
      return { nome_visitante: d.nome_visitante, instituicao: d.instituicao || null, telefone: tel, email: String(d.email) };
    }
    case 'projecto':
      return d.titulo && d.data_inicio && d.data_fim
        ? {
            titulo: d.titulo,
            descricao: d.descricao || '',
            data_inicio: new Date(d.data_inicio),
            data_fim: new Date(d.data_fim),
          }
        : null;
    case 'estagio': {
      if (d.estudante_id == null || !d.data_inicio || !d.data_fim) return null;
      const estId = Number(d.estudante_id);
      if (!Number.isInteger(estId) || estId < 1) return 'ESTUDANTE_INVALIDO';
      return { estudante_id: estId, data_inicio: new Date(d.data_inicio), data_fim: new Date(d.data_fim) };
    }
    default:
      return null;
  }
}

// RF13: valida choque entre as sessões propostas e os agendamentos aprovados do laboratório
async function validarAgendamentos(labId, ags, excludeActId) {
  const windows = ags.map((g) => ({ start: new Date(g.hora_inicio).getTime(), end: new Date(g.hora_fim).getTime() }));
  for (const w of windows) {
    if (Number.isNaN(w.start) || Number.isNaN(w.end) || w.start >= w.end) {
      throw HTTP(400, 'hora_fim deve ser posterior a hora_inicio');
    }
  }
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (windows[i].start < windows[j].end && windows[j].start < windows[i].end) {
        throw HTTP(409, 'As sessões selecionadas sobrepõem-se entre si');
      }
    }
  }
  const aprovados = await prisma.agendamento.findMany({
    where: {
      activo: true,
      estado: 'aprovado_supervisor',
      ...(excludeActId ? { NOT: { actividade_id: excludeActId } } : {}),
      actividade: { laboratorio_id: Number(labId), activo: true },
    },
    select: { hora_inicio: true, hora_fim: true },
  });
  for (const w of windows) {
    const choque = aprovados.some((g) => {
      const gs = new Date(g.hora_inicio).getTime();
      const ge = new Date(g.hora_fim).getTime();
      return w.start < ge && gs < w.end;
    });
    if (choque) {
      throw HTTP(409, 'Choque de horário: já existe um agendamento aprovado neste laboratório no intervalo indicado.');
    }
  }
}

// Aplana os materiais de todos os agendamentos (cada agendamento tem a sua lista)
function aplanarMateriais(ags) {
  return ags.flatMap((g) => (g.materiais || []).filter((r) => r && r.material_id != null));
}

// Agrega a quantidade pedida por material em toda a submissão e valida lab/stock (RF17)
async function validarMateriais(labId, mats) {
  const totais = new Map();
  for (const r of mats) {
    const qtd = Number(r.quantidade_estimada) || 0;
    if (qtd < 1) throw HTTP(400, 'A quantidade estimada de cada material deve ser maior que zero');
    const id = Number(r.material_id);
    totais.set(id, (totais.get(id) || 0) + qtd);
  }
  for (const [materialId, qtd] of totais) {
    const m = await prisma.material.findUnique({ where: { id: materialId }, include: { unidade: true } });
    if (!m || !m.activo) throw HTTP(404, 'Material não encontrado');
    if (m.laboratorio_id !== Number(labId)) {
      throw HTTP(400, `O material '${m.nome}' não pertence ao laboratório selecionado`);
    }
    if (qtd > m.quantidade) {
      throw HTTP(400, `Stock insuficiente para '${m.nome}' (disponível: ${m.quantidade} ${m.unidade?.nome ?? ''})`);
    }
  }
}

async function criarEspecialidade(tx, tipo, actividadId, spe) {
  if (tipo === 'aula') await tx.aula.create({ data: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'visita') await tx.visita.create({ data: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'projecto') await tx.projecto.create({ data: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'estagio') await tx.estagio.create({ data: { actividade_id: actividadId, ...spe } });
}

async function actualizarEspecialidade(tx, tipo, actividadId, spe) {
  if (tipo === 'aula') await tx.aula.upsert({ where: { actividade_id: actividadId }, update: spe, create: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'visita') await tx.visita.upsert({ where: { actividade_id: actividadId }, update: spe, create: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'projecto') await tx.projecto.upsert({ where: { actividade_id: actividadId }, update: spe, create: { actividade_id: actividadId, ...spe } });
  else if (tipo === 'estagio') await tx.estagio.upsert({ where: { actividade_id: actividadId }, update: spe, create: { actividade_id: actividadId, ...spe } });
}

async function crearAgendamentos(tx, actividadId, ags) {
  for (const g of ags) {
    const participantes = Number(g.num_participantes);
    if (!Number.isInteger(participantes) || participantes < 1) {
      throw HTTP(400, 'Cada agendamento precisa de num_participantes maior que zero');
    }
const ag = await tx.agendamento.create({
      data: {
        actividade_id: actividadId,
        num_participantes: participantes,
        hora_inicio: new Date(g.hora_inicio),
        hora_fim: new Date(g.hora_fim),
      },
    });
    const porMaterial = new Map();
    for (const r of g.materiais || []) {
      if (!r || r.material_id == null) continue;
      const id = Number(r.material_id);
      porMaterial.set(id, (porMaterial.get(id) || 0) + (Number(r.quantidade_estimada) || 0));
    }
    if (porMaterial.size) {
      await tx.agendamentoMaterial.createMany({
        data: [...porMaterial].map(([material_id, quantidade_estimada]) => ({
          agendamento_id: ag.id,
          material_id,
          quantidade_estimada,
        })),
      });
    }
  }
}

// POST /actividades/full — criação atómica (tudo ou nada)
// Validação de participantes por sessão (mesma regra de POST /agendamentos):
// aplica-se às sessões criadas/recriadas pela submissão.
async function validarParticipantesSessoes(tipo, labId, ags, periodo, configuracao) {
  for (const g of ags) {
    await validarSessao({ tipo, laboratorio_id: labId, num_participantes: g.num_participantes, hora_inicio: g.hora_inicio, hora_fim: g.hora_fim }, { periodo, configuracao });
  }
}

// Período (projeto/estágio) a partir dos detalhes submetidos, para validar que as
// sessões ficam dentro de [data_inicio, data_fim]. Aula e visita não têm período.
function periodoDosDetalhes(tipo, detalhes) {
  if (tipo !== 'projecto' && tipo !== 'estagio') return null;
  const d = detalhes || {};
  if (!d.data_inicio || !d.data_fim) return null;
  return { inicio: d.data_inicio, fim: d.data_fim };
}

router.post('/full', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { nome, responsavel_id, laboratorio_id, observacoes, tipo, detalhes, agendamentos } = req.body || {};
    if (!nome || !laboratorio_id || !tipo) {
      return res.status(400).json({ message: 'nome, laboratorio_id e tipo são obrigatórios' });
    }
    if (!['aula', 'visita', 'projecto', 'estagio'].includes(tipo)) {
      return res.status(400).json({ message: 'tipo inválido' });
    }
    const lab = await prisma.laboratorio.findUnique({ where: { id: Number(laboratorio_id) } });
    if (!lab || !lab.activo) return res.status(404).json({ message: 'Laboratório não encontrado' });

    const respId = await resolverResponsavel(req, { responsavel_id }, tipo);
    const ags = (agendamentos || []).filter((g) => g && g.hora_inicio && g.hora_fim);
    if (ags.length === 0) {
      return res.status(400).json({ message: 'A atividade tem de ter pelo menos uma sessão.' });
    }
    const mats = aplanarMateriais(ags);

    const spe = montarDetalhes(tipo, detalhes);
    if (spe === 'TELEFONE_INVALIDO') return res.status(400).json({ message: 'Telefone inválido (9 dígitos)' });
    if (spe === 'EMAIL_INVALIDO') return res.status(400).json({ message: 'Email inválido' });
    if (spe === 'ESTUDANTE_INVALIDO') return res.status(400).json({ message: 'Estudante inválido' });
    if (!spe) {
      if (tipo === 'estagio') return res.status(400).json({ message: 'Selecione o estudante' });
      return res.status(400).json({ message: 'Faltam detalhes obrigatórios para o tipo selecionado' });
    }
    if (tipo === 'estagio' && spe.estudante_id) {
      const est = await prisma.estudante.findUnique({ where: { id: spe.estudante_id } });
      if (!est || !est.activo) return res.status(400).json({ message: 'Estudante não encontrado ou inactivo' });
    }

    await validarAgendamentos(lab.id, ags, null);
    await validarMateriais(lab.id, mats);
    const configuracao = await obterConfiguracaoGeral();
    await validarParticipantesSessoes(tipo, lab.id, ags, periodoDosDetalhes(tipo, detalhes), configuracao);

    const novo = await prisma.$transaction(async (tx) => {
      const act = await tx.actividade.create({
        data: {
          nome,
          criado_por_id: req.user.id,
          responsavel_id: respId,
          laboratorio_id: Number(laboratorio_id),
          tipo,
          estado: 'pendente',
          observacoes: observacoes || '',
        },
      });
      await criarEspecialidade(tx, tipo, act.id, spe);
      await crearAgendamentos(tx, act.id, ags);
      return tx.actividade.findUnique({ where: { id: act.id }, include: actInclude });
    });
    res.status(201).json(toActividadeGet(novo));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

// PUT /actividades/:id/full — edição atómica (substitui agendamentos e materiais)
router.put('/:id/full', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const act = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // Regras 1 (estado) + 2 (autoria): só o responsável/Admin, e só sem sessões revistas.
    const perm = await podeAlterarActividade(act, req.user);
    if (!perm.ok) return res.status(perm.status).json({ message: perm.motivo });

    const { nome, responsavel_id, laboratorio_id, observacoes, tipo, detalhes, agendamentos } = req.body || {};

    // Regra 3: tipo e laboratório são imutáveis (mesmo para o Admin). Aceita-se
    // reenviar o valor actual; qualquer alteração é rejeitada com 400.
    if (tipo !== undefined && tipo !== act.tipo) {
      return res.status(400).json({ message: 'O tipo de uma atividade não pode ser alterado.' });
    }
    if (laboratorio_id !== undefined && Number(laboratorio_id) !== act.laboratorio_id) {
      return res.status(400).json({ message: 'O laboratório de uma atividade não pode ser alterado.' });
    }
    const novoTipo = act.tipo;
    const novoLabId = act.laboratorio_id;
    const lab = await prisma.laboratorio.findUnique({ where: { id: novoLabId } });
    if (!lab || !lab.activo) return res.status(404).json({ message: 'Laboratório não encontrado' });

    // Regra 3: só o Admin altera o responsável; os restantes só podem reenviar o actual.
    let respId;
    if (responsavel_id !== undefined) {
      if (req.user.tipo === 'admin') {
        respId = await resolverResponsavel(req, { responsavel_id }, novoTipo);
      } else if (Number(responsavel_id) !== act.responsavel_id) {
        return res.status(400).json({ message: 'Apenas um administrador pode alterar o responsável pela atividade.' });
      }
    }

    const ags = (agendamentos || []).filter((g) => g && g.hora_inicio && g.hora_fim);
    if (ags.length === 0) {
      return res.status(400).json({ message: 'A atividade tem de ter pelo menos uma sessão.' });
    }
    const mats = aplanarMateriais(ags);

    const spe = montarDetalhes(novoTipo, detalhes);
    if (spe === 'TELEFONE_INVALIDO') return res.status(400).json({ message: 'Telefone inválido (9 dígitos)' });
    if (spe === 'EMAIL_INVALIDO') return res.status(400).json({ message: 'Email inválido' });
    if (spe === 'ESTUDANTE_INVALIDO') return res.status(400).json({ message: 'Estudante inválido' });
    if (spe === null) {
      if (novoTipo === 'estagio') return res.status(400).json({ message: 'Selecione o estudante' });
      return res.status(400).json({ message: 'Faltam detalhes obrigatórios para o tipo selecionado' });
    }
    // validar existência/inactivo do estudante no estágio
    if (novoTipo === 'estagio' && spe.estudante_id) {
      const est = await prisma.estudante.findUnique({ where: { id: spe.estudante_id } });
      if (!est || !est.activo) return res.status(400).json({ message: 'Estudante não encontrado ou inactivo' });
    }

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (respId !== undefined) data.responsavel_id = respId;
    if (observacoes !== undefined) data.observacoes = observacoes;

    // Nota (AGENTS.md §4.5 / PLANO.md §0.1 ponto 7): a edição RECRIA as sessões —
    // as antigas são desactivadas e criam-se novas em `nao_revisto`. Só é possível
    // porque a regra 1 garante que nenhuma sessão activa tem decisão registada.
    const atualizado = await alterarComPermissao(act, req.user, async (tx) => {
      const up = await tx.actividade.update({ where: { id: act.id }, data, include: actInclude });
      const spe = montarDetalhes(novoTipo, detalhes);
      if (spe === 'TELEFONE_INVALIDO') throw HTTP(400, 'Telefone inválido (9 dígitos)');
      if (spe === 'EMAIL_INVALIDO') throw HTTP(400, 'Email inválido');
      if (spe === 'ESTUDANTE_INVALIDO') throw HTTP(400, 'Estudante inválido');
      if (spe === null) {
        if (novoTipo === 'estagio') throw HTTP(400, 'Selecione o estudante');
        throw HTTP(400, 'Faltam detalhes obrigatórios para o tipo selecionado');
      }
      if (spe) await actualizarEspecialidade(tx, novoTipo, act.id, spe);
      await tx.agendamento.updateMany({ where: { actividade_id: act.id, activo: true }, data: { activo: false } });
      await crearAgendamentos(tx, act.id, ags);
      return up;
    });
    res.json(toActividadeGet(atualizado));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

// DELETE /actividades/:id — soft
router.delete('/:id', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const a = await prisma.actividade.findUnique({ where: { id: Number(req.params.id) } });
    if (!a || !a.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // Regras 1 (estado) + 2 (autoria).
    const perm = await podeAlterarActividade(a, req.user);
    if (!perm.ok) return res.status(perm.status).json({ message: perm.motivo });

    await alterarComPermissao(a, req.user, (tx) =>
      tx.actividade.update({ where: { id: a.id }, data: { activo: false } }),
    );
    res.json({ message: 'Atividade removida' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

// ---- Sub-recursos por atividade ----

// GET /actividades/:id/aula
router.get('/:id/aula', async (req, res, next) => {
  try {
    const a = await prisma.aula.findFirst({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: { curso_disciplina: { include: { curso: true, disciplina: true } } },
    });
    res.json(a ? toAulaGet(a) : null);
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/visita
router.get('/:id/visita', async (req, res, next) => {
  try {
    const v = await prisma.visita.findFirst({ where: { actividade_id: Number(req.params.id), activo: true } });
    res.json(v ? toVisitaGet(v) : null);
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/projecto
router.get('/:id/projecto', async (req, res, next) => {
  try {
    const p = await prisma.projecto.findFirst({
      where: { actividade_id: Number(req.params.id), activo: true },
    });
    res.json(p ? toProjectoGet(p) : null);
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/estagio
router.get('/:id/estagio', async (req, res, next) => {
  try {
    const e = await prisma.estagio.findFirst({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: { estudante: true },
    });
    res.json(e ? toEstagioGet(e) : null);
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/materiais
router.get('/:id/materiais', async (req, res, next) => {
  try {
    const actId = Number(req.params.id);
    const ags = await prisma.agendamento.findMany({
      where: { actividade_id: actId, activo: true },
      select: { id: true },
    });
    const agIds = ags.map(a => a.id);
    let rows = [];
    if (agIds.length) {
      rows = await prisma.agendamentoMaterial.findMany({
        where: { agendamento_id: { in: agIds }, activo: true },
        include: { material: true },
        orderBy: { id: 'asc' },
      });
    }
    res.json(rows.map(toAgendamentoMaterialGet));
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/agendamentos
router.get('/:id/agendamentos', async (req, res, next) => {
  try {
    const rows = await prisma.agendamento.findMany({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: {
        actividade: { include: { laboratorio: true } },
        tecnicos: { where: { activo: true }, include: { utilizador: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toAgendamentoGet));
  } catch (err) {
    next(err);
  }
});

export default router;