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

const actInclude = { utilizador: true, laboratorio: true };

// ---- CRUD Actividades ----

// GET /actividades — listar (filtros tipo, estado, lab)
router.get('/', async (req, res, next) => {
  try {
    const where = { activo: true };
    if (req.query.tipo) where.tipo = req.query.tipo;
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.laboratorio_id) where.laboratorio_id = Number(req.query.laboratorio_id);
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
    const { nome, utilizador_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
    if (!nome || !laboratorio_id || !tipo) {
      return res.status(400).json({ message: 'nome, laboratorio_id e tipo são obrigatórios' });
    }
    const novo = await prisma.actividade.create({
      data: {
        nome,
        utilizador_id: Number(utilizador_id || req.user.id),
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
    const { nome, utilizador_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (utilizador_id !== undefined) data.utilizador_id = Number(utilizador_id);
    if (laboratorio_id !== undefined) data.laboratorio_id = Number(laboratorio_id);
    if (num_participantes !== undefined) data.num_participantes = num_participantes;
    if (observacoes !== undefined) data.observacoes = observacoes;
    if (precisa_assistente !== undefined) data.precisa_assistente = !!precisa_assistente;
    if (tipo !== undefined) data.tipo = tipo;
    const atualizado = await prisma.actividade.update({ where: { id: a.id }, data, include: actInclude });
    res.json(toActividadeGet(atualizado));
  } catch (err) {
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
      include: { responsavel: true },
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
      include: { responsavel: true, estudante: true },
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