import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// GET /labs
router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.laboratorios.filter((x) => x.activo !== false));
});

// GET /labs/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const l = db.laboratorios.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
  res.json(l);
});

// POST /labs — A
router.post('/', rbac('admin'), (req, res) => {
  const { nome, tipo, descricao } = req.body || {};
  if (!nome || !tipo) return res.status(400).json({ message: 'nome e tipo são obrigatórios' });
  const db = getDb();
  if (db.laboratorios.some((l) => l.activo !== false && l.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um laboratório com este nome' });
  }
  const now = new Date().toISOString();
  const novo = { id: genId(), nome, tipo, descricao: descricao || '', activo: true, criado_em: now, actualizado_em: now };
  db.laboratorios.push(novo);
  persist();
  res.status(201).json(novo);
});

// PUT /labs/:id — A
router.put('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const l = db.laboratorios.find((x) => x.id === Number(req.params.id));
  if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
  const { nome, tipo, descricao } = req.body || {};
  if (nome !== undefined && db.laboratorios.some((x) => x.activo !== false && x.id !== l.id && x.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um laboratório com este nome' });
  }
  if (nome !== undefined) l.nome = nome;
  if (tipo !== undefined) l.tipo = tipo;
  if (descricao !== undefined) l.descricao = descricao;
  l.actualizado_em = new Date().toISOString();
  persist();
  res.json(l);
});

// DELETE /labs/:id — A (soft)
router.delete('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const l = db.laboratorios.find((x) => x.id === Number(req.params.id));
  if (!l) return res.status(404).json({ message: 'Laboratório não encontrado' });
  l.activo = false;
  persist();
  res.json({ message: 'Laboratório removido' });
});

export default router;
