import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import {
  toActividadeGet,
  toAulaGet,
  toVisitaGet,
  toProjectoGet,
  toEstagioGet,
  toActividadeTecnicoGet,
  toActividadeMaterialGet,
  toAgendamentoGet,
} from '../utils/dto.js';

const router = Router();
router.use(authRequired);
const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const actInclude = { criado_por: true, responsavel: true, laboratorio: true };

// Roles que podem designar um terceiro como responsável (RF02 + regra de responsabilidade)
const PODE_DESIGNAR = ['admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

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
      where.atividadeTecnicos = { some: { activo: true, utilizador_id: req.user.id } };
    }
    const rows = await prisma.actividade.findMany({ where, include: actInclude, orderBy: { id: 'asc' } });
    res.json(rows.map(toActividadeGet));
  } catch (err) {
    next(err);
  }
});

// GET /actividades/:id
router.get('/:id', async (req, res, next) => {
  try {
    const a = await prisma.actividade.findFirst({ where: { id: Number(req.params.id), activo: true }, include: actInclude });
    if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
    res.json(toActividadeGet(a));
  } catch (err) {
    next(err);
  }
});

// POST /actividades — criar
router.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { nome, responsavel_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
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
        num_participantes: num_participantes ?? 1,
        precisa_assistente: !!precisa_assistente,
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
    if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
    const { nome, responsavel_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (laboratorio_id !== undefined) data.laboratorio_id = Number(laboratorio_id);
    if (num_participantes !== undefined) data.num_participantes = num_participantes;
    if (observacoes !== undefined) data.observacoes = observacoes;
    if (precisa_assistente !== undefined) data.precisa_assistente = !!precisa_assistente;
    if (tipo !== undefined) data.tipo = tipo;
    // o responsável apenas pode ser alterado por quem pode designar terceiros
    if (responsavel_id !== undefined && PODE_DESIGNAR.includes(req.user.tipo)) {
      const novoTipo = tipo || a.tipo;
      data.responsavel_id = await resolverResponsavel(req, { responsavel_id }, novoTipo);
    } else if (req.user.tipo === 'professor') {
      data.responsavel_id = req.user.id;
    }
    const atualizado = await prisma.actividade.update({ where: { id: a.id }, data, include: actInclude });
    res.json(toActividadeGet(atualizado));
  } catch (err) {
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
    case 'visita':
      return d.nome_visitante && d.telefone && d.email
        ? { nome_visitante: d.nome_visitante, instituicao: d.instituicao || null, telefone: d.telefone, email: d.email }
        : null;
    case 'projecto':
      return d.titulo && d.data_inicio && d.data_fim
        ? {
            titulo: d.titulo,
            descricao: d.descricao || '',
            data_inicio: new Date(d.data_inicio),
            data_fim: new Date(d.data_fim),
          }
        : null;
    case 'estagio':
      return d.estudante_id != null && d.data_inicio && d.data_fim
        ? {
            estudante_id: Number(d.estudante_id),
            data_inicio: new Date(d.data_inicio),
            data_fim: new Date(d.data_fim),
          }
        : null;
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

// Valida os pedidos de materiais: devem pertencer ao laboratório e respeitar o stock disponível (RF17)
async function validarMateriais(labId, mats) {
  for (const r of mats) {
    const m = await prisma.material.findUnique({ where: { id: Number(r.material_id) } });
    if (!m || !m.activo) throw HTTP(404, 'Material não encontrado');
    if (m.laboratorio_id !== Number(labId)) {
      throw HTTP(400, `O material '${m.nome}' não pertence ao laboratório selecionado`);
    }
    const qtd = Number(r.quantidade_estimada) || 0;
    if (qtd < 1) throw HTTP(400, `A quantidade estimada do material '${m.nome}' deve ser maior que zero`);
    if (qtd > m.quantidade) {
      throw HTTP(400, `Stock insuficiente para '${m.nome}' (disponível: ${m.quantidade} ${m.unidade})`);
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
    await tx.agendamento.create({
      data: { actividade_id: actividadId, hora_inicio: new Date(g.hora_inicio), hora_fim: new Date(g.hora_fim) },
    });
  }
}

async function crearMateriais(tx, actividadeId, mats) {
  for (const r of mats) {
    await tx.actividadeMaterial.create({
      data: { actividade_id: actividadeId, material_id: Number(r.material_id), quantidade_estimada: Number(r.quantidade_estimada) },
    });
  }
}

// POST /actividades/full — criação atómica (tudo ou nada)
router.post('/full', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { nome, responsavel_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo, detalhes, agendamentos, materiais } = req.body || {};
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
    const mats = (materiais || []).filter((r) => r && r.material_id != null);

    const spe = montarDetalhes(tipo, detalhes);
    if (!spe) return res.status(400).json({ message: 'Faltam detalhes obrigatórios para o tipo selecionado' });

    await validarAgendamentos(lab.id, ags, null);
    await validarMateriais(lab.id, mats);

    const novo = await prisma.$transaction(async (tx) => {
      const act = await tx.actividade.create({
        data: {
          nome,
          criado_por_id: req.user.id,
          responsavel_id: respId,
          laboratorio_id: Number(laboratorio_id),
          tipo,
          estado: 'pendente',
          num_participantes: num_participantes ?? 1,
          precisa_assistente: !!precisa_assistente,
          observacoes: observacoes || '',
        },
      });
      await criarEspecialidade(tx, tipo, act.id, spe);
      await crearAgendamentos(tx, act.id, ags);
      await crearMateriais(tx, act.id, mats);
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

    const { nome, responsavel_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo, detalhes, agendamentos, materiais } = req.body || {};
    const novoTipo = tipo || act.tipo;
    const novoLabId = laboratorio_id != null ? Number(laboratorio_id) : act.laboratorio_id;
    if (!['aula', 'visita', 'projecto', 'estagio'].includes(novoTipo)) {
      return res.status(400).json({ message: 'tipo inválido' });
    }
    const lab = await prisma.laboratorio.findUnique({ where: { id: novoLabId } });
    if (!lab || !lab.activo) return res.status(404).json({ message: 'Laboratório não encontrado' });

    // responsável: alterar apenas se enviado e o utilizador puder designar terceiros;
    // professor mantém-se (ou volta) como responsável da própria atividade.
    let respId;
    if (responsavel_id !== undefined && PODE_DESIGNAR.includes(req.user.tipo)) {
      respId = await resolverResponsavel(req, { responsavel_id }, novoTipo);
    } else if (req.user.tipo === 'professor') {
      respId = req.user.id;
    }

    const ags = (agendamentos || []).filter((g) => g && g.hora_inicio && g.hora_fim);
    const mats = (materiais || []).filter((r) => r && r.material_id != null);

    await validarAgendamentos(novoLabId, ags, act.id);
    await validarMateriais(novoLabId, mats);

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (respId !== undefined) data.responsavel_id = respId;
    if (laboratorio_id !== undefined) data.laboratorio_id = Number(laboratorio_id);
    if (num_participantes !== undefined) data.num_participantes = num_participantes;
    if (observacoes !== undefined) data.observacoes = observacoes;
    if (precisa_assistente !== undefined) data.precisa_assistente = !!precisa_assistente;
    if (tipo !== undefined) data.tipo = tipo;

    const atualizado = await prisma.$transaction(async (tx) => {
      const up = await tx.actividade.update({ where: { id: act.id }, data, include: actInclude });
      const spe = montarDetalhes(novoTipo, detalhes);
      if (spe) await actualizarEspecialidade(tx, novoTipo, act.id, spe);
      await tx.agendamento.updateMany({ where: { actividade_id: act.id, activo: true }, data: { activo: false } });
      await crearAgendamentos(tx, act.id, ags);
      await tx.actividadeMaterial.updateMany({ where: { actividade_id: act.id, activo: true }, data: { activo: false } });
      for (const r of mats) {
        await tx.actividadeMaterial.upsert({
          where: { actividade_id_material_id: { actividade_id: act.id, material_id: Number(r.material_id) } },
          update: { quantidade_estimada: Number(r.quantidade_estimada), activo: true },
          create: { actividade_id: act.id, material_id: Number(r.material_id), quantidade_estimada: Number(r.quantidade_estimada) },
        });
      }
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
    if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
    await prisma.actividade.update({ where: { id: a.id }, data: { activo: false } });
    res.json({ message: 'Atividade removida' });
  } catch (err) {
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
// GET /actividades/:id/tecnicos
router.get('/:id/tecnicos', async (req, res, next) => {
  try {
    const rows = await prisma.actividadeTecnico.findMany({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: { utilizador: true },
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toActividadeTecnicoGet));
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/materiais
router.get('/:id/materiais', async (req, res, next) => {
  try {
    const rows = await prisma.actividadeMaterial.findMany({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: { material: true },
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toActividadeMaterialGet));
  } catch (err) {
    next(err);
  }
});
// GET /actividades/:id/agendamentos
router.get('/:id/agendamentos', async (req, res, next) => {
  try {
    const rows = await prisma.agendamento.findMany({
      where: { actividade_id: Number(req.params.id), activo: true },
      include: { actividade: { include: { laboratorio: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toAgendamentoGet));
  } catch (err) {
    next(err);
  }
});

export default router;