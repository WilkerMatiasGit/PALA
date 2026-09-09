import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);
const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

// ---- CRUD Actividades ----

// GET /actividades — listar (filtros tipo, estado, lab)
router.get('/', (req, res) => {
  const db = getDb();
  let result = db.actividades.filter((x) => x.activo !== false);
  if (req.query.tipo) result = result.filter((a) => a.tipo === req.query.tipo);
  if (req.query.estado) result = result.filter((a) => a.estado === req.query.estado);
  if (req.query.laboratorio_id) result = result.filter((a) => a.laboratorio_id === Number(req.query.laboratorio_id));
  res.json(result);
});

// GET /actividades/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const a = db.actividades.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
  res.json(a);
});

// POST /actividades — criar
router.post('/', rbac(...ACT_ROLES), (req, res) => {
  const { nome, utilizador_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
  if (!nome || !laboratorio_id || !tipo) {
    return res.status(400).json({ message: 'nome, laboratorio_id e tipo são obrigatórios' });
  }
  const db = getDb();
  const user = db.utilizadores.find((u) => u.id === Number(utilizador_id || req.user.id));
  const lab = db.laboratorios.find((l) => l.id === Number(laboratorio_id));
  const now = new Date().toISOString();
  const novo = {
    id: genId(),
    nome,
    utilizador_id: Number(utilizador_id || req.user.id),
    utilizador_nome: user?.nome ?? req.user.nome,
    laboratorio_id: Number(laboratorio_id),
    laboratorio_nome: lab?.nome ?? '',
    tipo,
    estado: 'pendente',
    num_participantes: num_participantes ?? 1,
    precisa_assistente: !!precisa_assistente,
    observacoes: observacoes || '',
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.actividades.push(novo);
  persist();
  res.status(201).json(novo);
});

// PUT /actividades/:id
router.put('/:id', rbac(...ACT_ROLES), (req, res) => {
  const db = getDb();
  const a = db.actividades.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
  const { nome, utilizador_id, laboratorio_id, num_participantes, observacoes, precisa_assistente, tipo } = req.body || {};
  if (nome !== undefined) a.nome = nome;
  if (utilizador_id !== undefined) {
    a.utilizador_id = Number(utilizador_id);
    const u = db.utilizadores.find((x) => x.id === Number(utilizador_id));
    a.utilizador_nome = u?.nome ?? '';
  }
  if (laboratorio_id !== undefined) {
    a.laboratorio_id = Number(laboratorio_id);
    const l = db.laboratorios.find((x) => x.id === Number(laboratorio_id));
    a.laboratorio_nome = l?.nome ?? '';
  }
  if (num_participantes !== undefined) a.num_participantes = num_participantes;
  if (observacoes !== undefined) a.observacoes = observacoes;
  if (precisa_assistente !== undefined) a.precisa_assistente = !!precisa_assistente;
  if (tipo !== undefined) a.tipo = tipo;
  a.actualizado_em = new Date().toISOString();
  persist();
  res.json(a);
});

// DELETE /actividades/:id — soft
router.delete('/:id', rbac(...ACT_ROLES), (req, res) => {
  const db = getDb();
  const a = db.actividades.find((x) => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ message: 'Atividade não encontrada' });
  a.activo = false;
  persist();
  res.json({ message: 'Atividade removida' });
});

// ---- Sub-recursos por atividade ----

// GET /actividades/:id/aula
router.get('/:id/aula', (req, res) => {
  const db = getDb();
  const a = db.aulas.find((x) => x.actividade_id === Number(req.params.id) && x.activo !== false);
  res.json(a || null);
});
// GET /actividades/:id/visita
router.get('/:id/visita', (req, res) => {
  const db = getDb();
  const v = db.visitas.find((x) => x.actividade_id === Number(req.params.id) && x.activo !== false);
  res.json(v || null);
});
// GET /actividades/:id/projecto
router.get('/:id/projecto', (req, res) => {
  const db = getDb();
  const p = db.projectos.find((x) => x.actividade_id === Number(req.params.id) && x.activo !== false);
  res.json(p || null);
});
// GET /actividades/:id/estagio
router.get('/:id/estagio', (req, res) => {
  const db = getDb();
  const e = db.estagios.find((x) => x.actividade_id === Number(req.params.id) && x.activo !== false);
  res.json(e || null);
});
// GET /actividades/:id/tecnicos
router.get('/:id/tecnicos', (req, res) => {
  const db = getDb();
  res.json(db.actividadeTecnicos.filter((t) => t.actividade_id === Number(req.params.id) && t.activo !== false));
});
// GET /actividades/:id/materiais
router.get('/:id/materiais', (req, res) => {
  const db = getDb();
  res.json(db.actividadeMateriais.filter((m) => m.actividade_id === Number(req.params.id) && m.activo !== false));
});
// GET /actividades/:id/agendamentos
router.get('/:id/agendamentos', (req, res) => {
  const db = getDb();
  res.json(db.agendamentos.filter((g) => g.actividade_id === Number(req.params.id) && g.activo !== false));
});

export default router;
