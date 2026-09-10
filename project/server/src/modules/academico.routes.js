import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toDisciplinaGet, toCursoDisciplinaGet, toEstudanteGet } from '../utils/dto.js';

// ---- Disciplinas ----
const disciplinas = Router();
disciplinas.use(authRequired);

disciplinas.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.disciplina.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    res.json(rows.map(toDisciplinaGet));
  } catch (err) {
    next(err);
  }
});

disciplinas.post('/', rbac('admin'), async (req, res, next) => {
  try {
    const { nome } = req.body || {};
    if (!nome) return res.status(400).json({ message: 'nome é obrigatório' });
    const dup = await prisma.disciplina.findFirst({
      where: { activo: true, nome: { equals: String(nome).trim(), mode: 'insensitive' } },
    });
    if (dup) return res.status(409).json({ message: 'Já existe uma disciplina com este nome' });
    const nova = await prisma.disciplina.create({ data: { nome } });
    res.status(201).json(toDisciplinaGet(nova));
  } catch (err) {
    next(err);
  }
});

disciplinas.put('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const d = await prisma.disciplina.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) return res.status(404).json({ message: 'Disciplina não encontrada' });
    const atualizada = await prisma.disciplina.update({
      where: { id: d.id },
      data: req.body.nome !== undefined ? { nome: req.body.nome } : {},
    });
    res.json(toDisciplinaGet(atualizada));
  } catch (err) {
    next(err);
  }
});

disciplinas.delete('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const d = await prisma.disciplina.findUnique({ where: { id: Number(req.params.id) } });
    if (!d) return res.status(404).json({ message: 'Disciplina não encontrada' });
    await prisma.disciplina.update({ where: { id: d.id }, data: { activo: false } });
    res.json({ message: 'Disciplina removida' });
  } catch (err) {
    next(err);
  }
});

export const disciplinasRouter = disciplinas;

// ---- Curso-Disciplinas ----
const cursoDisciplinas = Router();
cursoDisciplinas.use(authRequired);

const cursoDisciplinaInclude = { curso: true, disciplina: true };

cursoDisciplinas.get('/', async (req, res, next) => {
  try {
    const where = { activo: true };
    if (req.query.curso_id) where.curso_id = Number(req.query.curso_id);
    const rows = await prisma.cursoDisciplina.findMany({
      where,
      include: cursoDisciplinaInclude,
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toCursoDisciplinaGet));
  } catch (err) {
    next(err);
  }
});

cursoDisciplinas.post('/', rbac('admin'), async (req, res, next) => {
  try {
    const { curso_id, disciplina_id, semestre } = req.body || {};
    if (!curso_id || !disciplina_id || semestre == null) {
      return res.status(400).json({ message: 'curso_id, disciplina_id e semestre são obrigatórios' });
    }
    const dup = await prisma.cursoDisciplina.findFirst({
      where: {
        activo: true,
        curso_id: Number(curso_id),
        disciplina_id: Number(disciplina_id),
      },
    });
    if (dup) return res.status(409).json({ message: 'Esta disciplina já está associada a este curso' });
    const nova = await prisma.cursoDisciplina.create({
      data: { curso_id: Number(curso_id), disciplina_id: Number(disciplina_id), semestre: Number(semestre) },
      include: cursoDisciplinaInclude,
    });
    res.status(201).json(toCursoDisciplinaGet(nova));
  } catch (err) {
    next(err);
  }
});

cursoDisciplinas.delete('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const cd = await prisma.cursoDisciplina.findUnique({ where: { id: Number(req.params.id) } });
    if (!cd) return res.status(404).json({ message: 'Associação não encontrada' });
    await prisma.cursoDisciplina.update({ where: { id: cd.id }, data: { activo: false } });
    res.json({ message: 'Associação removida' });
  } catch (err) {
    next(err);
  }
});

export const cursoDisciplinasRouter = cursoDisciplinas;

// ---- Estudantes ----
const estudantes = Router();
estudantes.use(authRequired);

const estudanteInclude = { curso: true };

estudantes.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.estudante.findMany({
      where: { activo: true },
      include: estudanteInclude,
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toEstudanteGet));
  } catch (err) {
    next(err);
  }
});

estudantes.get('/:id', async (req, res, next) => {
  try {
    const e = await prisma.estudante.findFirst({
      where: { id: Number(req.params.id), activo: true },
      include: estudanteInclude,
    });
    if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
    res.json(toEstudanteGet(e));
  } catch (err) {
    next(err);
  }
});

estudantes.post('/', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const { id, nome, curso_id } = req.body || {};
    if (!id || !nome || !curso_id) return res.status(400).json({ message: 'id (matrícula), nome e curso_id são obrigatórios' });
    const existing = await prisma.estudante.findUnique({ where: { id: Number(id) } });
    if (existing) {
      return res.status(409).json({ message: 'Já existe um estudante com este número de matrícula' });
    }
    const novo = await prisma.estudante.create({
      data: { id: Number(id), nome, curso_id: Number(curso_id) },
      include: estudanteInclude,
    });
    res.status(201).json(toEstudanteGet(novo));
  } catch (err) {
    next(err);
  }
});

estudantes.put('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const e = await prisma.estudante.findUnique({ where: { id: Number(req.params.id) } });
    if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
    const { nome, curso_id } = req.body || {};
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (curso_id !== undefined) data.curso_id = Number(curso_id);
    const atualizado = await prisma.estudante.update({
      where: { id: e.id },
      data,
      include: estudanteInclude,
    });
    res.json(toEstudanteGet(atualizado));
  } catch (err) {
    next(err);
  }
});

estudantes.delete('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const e = await prisma.estudante.findUnique({ where: { id: Number(req.params.id) } });
    if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
    await prisma.estudante.update({ where: { id: e.id }, data: { activo: false } });
    res.json({ message: 'Estudante removido' });
  } catch (err) {
    next(err);
  }
});

export const estudantesRouter = estudantes;