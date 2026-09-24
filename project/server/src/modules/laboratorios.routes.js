import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toLabGet } from '../utils/dto.js';
import { unidadeLaboratorialId } from '../utils/catalogos.js';

const router = Router();
router.use(authRequired);

const labInclude = { unidadeLaboratorial: true };

// GET /labs
router.get('/', async (req, res, next) => {
  try {
    const labs = await prisma.laboratorio.findMany({ where: { activo: true }, include: labInclude, orderBy: { id: 'asc' } });
    res.json(labs.map(toLabGet));
  } catch (err) {
    next(err);
  }
});

// GET /labs/:id — [A,T,C,S,CD] (professor vê só a lista, sem drill-down de materiais)
router.get('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const l = await prisma.laboratorio.findFirst({ where: { id: Number(req.params.id), activo: true }, include: labInclude });
    if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
    res.json(toLabGet(l));
  } catch (err) {
    next(err);
  }
});

// POST /labs — A
router.post('/', rbac('admin'), async (req, res, next) => {
  try {
    const { nome, tipo, descricao } = req.body || {};
    if (!nome || !tipo) return res.status(400).json({ message: 'nome e tipo são obrigatórios' });
    const unidade_laboratorial_id = await unidadeLaboratorialId(tipo);
    if (!unidade_laboratorial_id) {
      return res.status(400).json({ message: `Tipo de laboratório desconhecido: ${tipo}` });
    }
    const existing = await prisma.laboratorio.findFirst({
      where: { activo: true, nome: String(nome).trim() },
    });
    if (existing) {
      return res.status(409).json({ message: 'Já existe um laboratório com este nome' });
    }
    const novo = await prisma.laboratorio.create({
      data: { nome, unidade_laboratorial_id, descricao: descricao || '' },
      include: labInclude,
    });
    res.status(201).json(toLabGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /labs/:id — A
router.put('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const l = await prisma.laboratorio.findUnique({ where: { id: Number(req.params.id) } });
    if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
    const { nome, tipo, descricao } = req.body || {};
    if (nome !== undefined) {
      const dup = await prisma.laboratorio.findFirst({
        where: { activo: true, id: { not: l.id }, nome: String(nome).trim() },
      });
      if (dup) return res.status(409).json({ message: 'Já existe um laboratório com este nome' });
    }
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (tipo !== undefined) {
      const unidade_laboratorial_id = await unidadeLaboratorialId(tipo);
      if (!unidade_laboratorial_id) {
        return res.status(400).json({ message: `Tipo de laboratório desconhecido: ${tipo}` });
      }
      data.unidade_laboratorial_id = unidade_laboratorial_id;
    }
    if (descricao !== undefined) data.descricao = descricao;
    const atualizado = await prisma.laboratorio.update({ where: { id: l.id }, data, include: labInclude });
    res.json(toLabGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// DELETE /labs/:id — A (soft)
router.delete('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const l = await prisma.laboratorio.findUnique({ where: { id: Number(req.params.id) } });
    if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
    await prisma.laboratorio.update({ where: { id: l.id }, data: { activo: false } });
    res.json({ message: 'Laboratório removido' });
  } catch (err) {
    next(err);
  }
});

export default router;