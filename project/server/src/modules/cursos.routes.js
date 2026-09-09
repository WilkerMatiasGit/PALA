import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// GET /cursos — todos
router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.cursos.filter((x) => x.activo !== false));
});

// GET /cursos/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const c = db.cursos.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
  res.json(c);
});

// POST /cursos — A
router.post('/', rbac('admin'), (req, res) => {
  const { departamento, nome, abreviacao } = req.body || {};
  if (!departamento || !nome || !abreviacao) {
    return res.status(400).json({ message: 'departamento, nome e abreviacao são obrigatórios' });
  }
  const db = getDb();
  if (db.cursos.some((c) => c.activo !== false && c.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um curso com este nome' });
  }
  const now = new Date().toISOString();
  const novo = { id: genId(), departamento, nome, abreviacao, activo: true, criado_em: now, actualizado_em: now };
  db.cursos.push(novo);
  persist();
  res.status(201).json(novo);
});

// PUT /cursos/:id — A
router.put('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const c = db.cursos.find((x) => x.id === Number(req.params.id));
  if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
  const { departamento, nome, abreviacao } = req.body || {};
  if (nome !== undefined && db.cursos.some((x) => x.activo !== false && x.id !== c.id && x.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um curso com este nome' });
  }
  if (departamento !== undefined) c.departamento = departamento;
  if (nome !== undefined) c.nome = nome;
  if (abreviacao !== undefined) c.abreviacao = abreviacao;
  c.actualizado_em = new Date().toISOString();
  persist();
  res.json(c);
});

// DELETE /cursos/:id — A (soft)
router.delete('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const c = db.cursos.find((x) => x.id === Number(req.params.id));
  if (!c) return res.status(404).json({ message: 'Curso não encontrado' });
  c.activo = false;
  persist();
  res.json({ message: 'Curso removido' });
});

export default router;
