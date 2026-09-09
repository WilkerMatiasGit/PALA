import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { stockActual } from '../utils/stock.js';

const router = Router();
router.use(authRequired);

// GET /materiais — listar (filtros laboratorio_id, categoria, estado)
router.get('/', (req, res) => {
  const db = getDb();
  let result = db.materiais.filter((x) => x.activo !== false);
  if (req.query.laboratorio_id) result = result.filter((m) => m.laboratorio_id === Number(req.query.laboratorio_id));
  if (req.query.categoria) result = result.filter((m) => m.categoria === req.query.categoria);
  if (req.query.estado) result = result.filter((m) => m.estado === req.query.estado);
  res.json(result);
});

// GET /materiais/historico — movimentações (definir antes de /:id)
router.get('/historico', (req, res) => {
  const db = getDb();
  let result = db.historico.filter((x) => x.activo !== false);
  if (req.query.material_id) result = result.filter((h) => h.material_id === Number(req.query.material_id));
  if (req.query.motivo) result = result.filter((h) => h.motivo === req.query.motivo);
  res.json(result);
});

// POST /materiais/historico — registar movimentação (RF16/RF17)  [A,T,S,CD]
router.post('/historico', rbac('admin', 'tecnico', 'supervisor', 'chefe_departamento'), (req, res) => {
  const { material_id, utilizador_id, actividade_id, quantidade_movimentada, motivo, descricao } = req.body || {};
  if (!material_id || quantidade_movimentada == null || !motivo || !descricao) {
    return res.status(400).json({ message: 'material_id, quantidade_movimentada, motivo e descricao são obrigatórios' });
  }
  const db = getDb();
  const mat = db.materiais.find((m) => m.id === Number(material_id));
  if (!mat) return res.status(404).json({ message: 'Material não encontrado' });
  const user = db.utilizadores.find((u) => u.id === Number(utilizador_id));
  const act = db.actividades.find((a) => a.id === Number(actividade_id));
  const now = new Date().toISOString();
  const qty = Number(quantidade_movimentada);
  const nova = {
    id: genId(),
    material_id: Number(material_id),
    material_nome: mat.nome,
    utilizador_id: Number(utilizador_id),
    utilizador_nome: user?.nome ?? '',
    ...(actividade_id ? { actividade_id: Number(actividade_id), actividade_nome: act?.nome } : {}),
    quantidade_movimentada: qty,
    motivo,
    descricao,
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.historico.push(nova);
  // RF17: stock atualizado pelo SUM do histórico
  mat.quantidade = stockActual(Number(material_id));
  mat.actualizado_em = now;
  persist();
  res.status(201).json(nova);
});

// GET /materiais/:id/historico — movimentações de um material
router.get('/:id/historico', (req, res) => {
  const db = getDb();
  res.json(db.historico.filter((h) => h.material_id === Number(req.params.id) && h.activo !== false));
});

// GET /materiais/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const m = db.materiais.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!m) return res.status(404).json({ message: 'Material não encontrado' });
  // RF17: devolve quantidade calculada do histórico (fonte da verdade)
  m.quantidade = stockActual(m.id);
  res.json(m);
});

// POST /materiais — criar material (+ 1ª movimentação de stock inicial)  [A,T,C,S,CD]
router.post('/', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const { laboratorio_id, nome, categoria, quantidade_minima, unidade, estado, quantidade_inicial } = req.body || {};
  if (!laboratorio_id || !nome || !categoria || quantidade_minima == null || !unidade) {
    return res.status(400).json({ message: 'laboratorio_id, nome, categoria, quantidade_minima e unidade são obrigatórios' });
  }
  const db = getDb();
  const lab = db.laboratorios.find((l) => l.id === Number(laboratorio_id));
  if (!lab) return res.status(404).json({ message: 'Laboratório não encontrado' });
  if (db.materiais.some((m) => m.activo !== false && m.laboratorio_id === Number(laboratorio_id) && m.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um material com este nome neste laboratório' });
  }
  const now = new Date().toISOString();
  const inicial = Number(quantidade_inicial || 0);
  const novo = {
    id: genId(),
    laboratorio_id: Number(laboratorio_id),
    laboratorio_nome: lab.nome,
    nome,
    categoria,
    quantidade: inicial,
    quantidade_minima: Number(quantidade_minima),
    unidade,
    estado: estado || 'disponivel',
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.materiais.push(novo);
  // 1ª movimentação de stock inicial (RF17): quantidade nasce do histórico
  if (inicial !== 0) {
    db.historico.push({
      id: genId(),
      material_id: novo.id,
      material_nome: novo.nome,
      utilizador_id: req.user.id,
      utilizador_nome: req.user.nome,
      quantidade_movimentada: inicial,
      motivo: 'compra_stock',
      descricao: 'Stock inicial de registo',
      activo: true,
      criado_em: now,
      actualizado_em: now,
    });
    novo.quantidade = stockActual(novo.id);
  }
  persist();
  res.status(201).json(novo);
});

// PUT /materiais/:id — atualizar (SEM quantidade — RF17)  [A,T,C,S,CD]
router.put('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const m = db.materiais.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).json({ message: 'Material não encontrado' });
  const { nome, categoria, quantidade_minima, unidade, estado } = req.body || {};
  if (nome !== undefined && db.materiais.some((x) => x.activo !== false && x.id !== m.id && x.laboratorio_id === m.laboratorio_id && x.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe um material com este nome neste laboratório' });
  }
  if (nome !== undefined) m.nome = nome;
  if (categoria !== undefined) m.categoria = categoria;
  if (quantidade_minima !== undefined) m.quantidade_minima = Number(quantidade_minima);
  if (unidade !== undefined) m.unidade = unidade;
  if (estado !== undefined) m.estado = estado;
  m.actualizado_em = new Date().toISOString();
  persist();
  res.json(m);
});

// DELETE /materiais/:id — soft [A,T,C,S,CD]
router.delete('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const m = db.materiais.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).json({ message: 'Material não encontrado' });
  m.activo = false;
  persist();
  res.json({ message: 'Material removido' });
});

export default router;
