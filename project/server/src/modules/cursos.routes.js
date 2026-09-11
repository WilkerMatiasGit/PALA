import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toCursoGet } from '../utils/dto.js';

const router = Router();
router.use(authRequired);

// GET /cursos — todos
router.get('/', async (req, res, next) => {
  try {
    const cursos = await prisma.curso.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    res.json(cursos.map(toCursoGet));
  } catch (err) {
    next(err);
  }
});

// GET /cursos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const c = await prisma.curso.findFirst({ where: { id: Number(req.params.id), activo: true } });
    if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
    res.json(toCursoGet(c));
  } catch (err) {
    next(err);
  }
});

// POST /cursos — A
router.post('/', rbac('admin'), async (req, res, next) => {
  try {
    const { departamento, nome, abreviacao } = req.body || {};
    if (!departamento || !nome || !abreviacao) {
      return res.status(400).json({ message: 'departamento, nome e abreviacao são obrigatórios' });
    }
    const existing = await prisma.curso.findFirst({
      where: { activo: true, nome: String(nome).trim() },
    });
    if (existing) {
      return res.status(409).json({ message: 'Já existe um curso com este nome' });
    }
    const novo = await prisma.curso.create({ data: { departamento, nome, abreviacao } });
    res.status(201).json(toCursoGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /cursos/:id — A
router.put('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const c = await prisma.curso.findUnique({ where: { id: Number(req.params.id) } });
    if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
    const { departamento, nome, abreviacao } = req.body || {};
    if (nome !== undefined) {
      const dup = await prisma.curso.findFirst({
        where: { activo: true, id: { not: c.id }, nome: String(nome).trim() },
      });
      if (dup) return res.status(409).json({ message: 'Já existe um curso com este nome' });
    }
    const data = {};
    if (departamento !== undefined) data.departamento = departamento;
    if (nome !== undefined) data.nome = nome;
    if (abreviacao !== undefined) data.abreviacao = abreviacao;
    const atualizado = await prisma.curso.update({ where: { id: c.id }, data });
    res.json(toCursoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// DELETE /cursos/:id — A (soft)
router.delete('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const c = await prisma.curso.findUnique({ where: { id: Number(req.params.id) } });
    if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
    await prisma.curso.update({ where: { id: c.id }, data: { activo: false } });
    res.json({ message: 'Curso removido' });
  } catch (err) {
    next(err);
  }
});

export default router;