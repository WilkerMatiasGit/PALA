import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];
const upsertByActividade = (db, list, payload, atividadeId, build) => {
  const existing = list.find((x) => x.actividade_id === atividadeId && x.activo !== false);
  if (existing) {
    Object.assign(existing, build(existing, true), { actualizado_em: new Date().toISOString() });
    return existing;
  }
  const nova = build(null, false);
  list.push(nova);
  return nova;
};

// ---- Aulas ----
const aulas = Router();
aulas.use(authRequired);

// POST /aulas — upsert por atividade (cria se não existir, atualiza se existir)
aulas.post('/', rbac(...ACT_ROLES), (req, res) => {
  const { actividade_id, curso_disciplina_id, tema } = req.body || {};
  if (!actividade_id || !curso_disciplina_id) {
    return res.status(400).json({ message: 'actividade_id e curso_disciplina_id são obrigatórios' });
  }
  const db = getDb();
  const cd = db.cursoDisciplinas.find((x) => x.id === Number(curso_disciplina_id));
  const now = new Date().toISOString();
  const result = upsertByActividade(db, db.aulas, req.body, Number(actividade_id), (existing) => ({
    id: existing ? existing.id : genId(),
    actividade_id: Number(actividade_id),
    curso_disciplina_id: Number(curso_disciplina_id),
    curso_disciplina_nome: cd ? `${cd.disciplina_nome} (${cd.curso_nome} - ${cd.semestre}º Sem)` : '',
    tema: tema || '',
    activo: true,
    criado_em: existing ? existing.criado_em : now,
    actualizado_em: now,
  }));
  persist();
  res.status(200).json(result);
});

export const aulasRouter = aulas;

// ---- Visitas ----
const visitas = Router();
visitas.use(authRequired);

visitas.post('/', rbac(...ACT_ROLES), (req, res) => {
  const { actividade_id, nome_visitante, instituicao, telefone, email } = req.body || {};
  if (!actividade_id || !nome_visitante || !telefone || !email) {
    return res.status(400).json({ message: 'actividade_id, nome_visitante, telefone e email são obrigatórios' });
  }
  const db = getDb();
  const now = new Date().toISOString();
  const result = upsertByActividade(db, db.visitas, req.body, Number(actividade_id), (existing) => ({
    id: existing ? existing.id : genId(),
    actividade_id: Number(actividade_id),
    nome_visitante,
    ...(instituicao ? { instituicao } : {}),
    telefone,
    email,
    activo: true,
    criado_em: existing ? existing.criado_em : now,
    actualizado_em: now,
  }));
  persist();
  res.status(200).json(result);
});

export const visitasRouter = visitas;

// ---- Projectos ----
const projectos = Router();
projectos.use(authRequired);

projectos.post('/', rbac(...ACT_ROLES), (req, res) => {
  const { actividade_id, responsavel_id, titulo, descricao, data_inicio, data_fim } = req.body || {};
  if (!actividade_id || !responsavel_id || !titulo || !data_inicio || !data_fim) {
    return res.status(400).json({ message: 'actividade_id, responsavel_id, titulo, data_inicio e data_fim são obrigatórios' });
  }
  const db = getDb();
  const resp = db.utilizadores.find((u) => u.id === Number(responsavel_id));
  const now = new Date().toISOString();
  const result = upsertByActividade(db, db.projectos, req.body, Number(actividade_id), (existing) => ({
    id: existing ? existing.id : genId(),
    actividade_id: Number(actividade_id),
    responsavel_id: Number(responsavel_id),
    responsavel_nome: resp?.nome ?? '',
    titulo,
    descricao: descricao || '',
    data_inicio,
    data_fim,
    anexo_path: existing ? existing.anexo_path : undefined,
    activo: true,
    criado_em: existing ? existing.criado_em : now,
    actualizado_em: now,
  }));
  persist();
  res.status(200).json(result);
});

// PUT /projectos/:id/documento — submeter anexo (pós-conclusão)
projectos.put('/:id/documento', rbac(...ACT_ROLES), (req, res) => {
  const db = getDb();
  const p = db.projectos.find((x) => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ message: 'Projeto não encontrado' });
  const { anexo_path } = req.body || {};
  if (!anexo_path) return res.status(400).json({ message: 'anexo_path é obrigatório' });
  p.anexo_path = anexo_path;
  p.actualizado_em = new Date().toISOString();
  persist();
  res.json(p);
});

export const projectosRouter = projectos;

// ---- Estágios ----
const estagios = Router();
estagios.use(authRequired);

estagios.post('/', rbac(...ACT_ROLES), (req, res) => {
  const { actividade_id, responsavel_id, estudante_id, data_inicio, data_fim } = req.body || {};
  if (!actividade_id || !responsavel_id || !estudante_id || !data_inicio || !data_fim) {
    return res.status(400).json({ message: 'actividade_id, responsavel_id, estudante_id, data_inicio e data_fim são obrigatórios' });
  }
  const db = getDb();
  const resp = db.utilizadores.find((u) => u.id === Number(responsavel_id));
  const est = db.estudantes.find((e) => e.id === Number(estudante_id));
  const now = new Date().toISOString();
  const result = upsertByActividade(db, db.estagios, req.body, Number(actividade_id), (existing) => ({
    id: existing ? existing.id : genId(),
    actividade_id: Number(actividade_id),
    responsavel_id: Number(responsavel_id),
    responsavel_nome: resp?.nome ?? '',
    estudante_id: Number(estudante_id),
    estudante_nome: est?.nome ?? '',
    data_inicio,
    data_fim,
    anexo_path: existing ? existing.anexo_path : undefined,
    activo: true,
    criado_em: existing ? existing.criado_em : now,
    actualizado_em: now,
  }));
  persist();
  res.status(200).json(result);
});

// PUT /estagios/:id/documento — submeter anexo (pós-conclusão)
estagios.put('/:id/documento', rbac(...ACT_ROLES), (req, res) => {
  const db = getDb();
  const e = db.estagios.find((x) => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ message: 'Estágio não encontrado' });
  const { anexo_path } = req.body || {};
  if (!anexo_path) return res.status(400).json({ message: 'anexo_path é obrigatório' });
  e.anexo_path = anexo_path;
  e.actualizado_em = new Date().toISOString();
  persist();
  res.json(e);
});

export const estagiosRouter = estagios;

// ---- Actividade-Técnico ----
const atividadeTecnico = Router();
atividadeTecnico.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor'));

// POST /actividade-tecnico — atribuir técnico (validador) ou assistente
atividadeTecnico.post('/', (req, res) => {
  const { actividade_id, utilizador_id, papel } = req.body || {};
  if (!actividade_id || !utilizador_id || !papel) {
    return res.status(400).json({ message: 'actividade_id, utilizador_id e papel são obrigatórios' });
  }
  const db = getDb();
  const user = db.utilizadores.find((u) => u.id === Number(utilizador_id));
  const act = db.actividades.find((a) => a.id === Number(actividade_id));
  // Evitar duplicados do mesmo papel para a mesma atividade
  const existing = db.actividadeTecnicos.find(
    (t) => t.actividade_id === Number(actividade_id) && t.papel === papel && t.activo !== false
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.utilizador_id = Number(utilizador_id);
    existing.utilizador_nome = user?.nome ?? '';
    existing.actualizado_em = now;
    persist();
    return res.json(existing);
  }
  const novo = {
    id: genId(),
    actividade_id: Number(actividade_id),
    utilizador_id: Number(utilizador_id),
    utilizador_nome: user?.nome ?? '',
    papel,
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.actividadeTecnicos.push(novo);
  persist();
  res.status(201).json(novo);
});

// DELETE /actividade-tecnico/:id
atividadeTecnico.delete('/:id', (req, res) => {
  const db = getDb();
  const t = db.actividadeTecnicos.find((x) => x.id === Number(req.params.id));
  if (!t) return res.status(404).json({ message: 'Atribuição não encontrada' });
  t.activo = false;
  persist();
  res.json({ message: 'Atribuição removida' });
});

export const atividadeTecnicoRouter = atividadeTecnico;

// ---- Actividade-Materiais ----
const atividadeMateriais = Router();
atividadeMateriais.use(authRequired, rbac(...ACT_ROLES));

// POST /actividade-materiais
atividadeMateriais.post('/', (req, res) => {
  const { actividade_id, material_id, quantidade_estimada } = req.body || {};
  if (!actividade_id || !material_id || quantidade_estimada == null) {
    return res.status(400).json({ message: 'actividade_id, material_id e quantidade_estimada são obrigatórios' });
  }
  const db = getDb();
  const mat = db.materiais.find((m) => m.id === Number(material_id));
  const existing = db.actividadeMateriais.find(
    (x) => x.actividade_id === Number(actividade_id) && x.material_id === Number(material_id) && x.activo !== false
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.quantidade_estimada = Number(quantidade_estimada);
    existing.actualizado_em = now;
    persist();
    return res.json(existing);
  }
  const novo = {
    id: genId(),
    actividade_id: Number(actividade_id),
    material_id: Number(material_id),
    material_nome: mat?.nome ?? '',
    quantidade_estimada: Number(quantidade_estimada),
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.actividadeMateriais.push(novo);
  persist();
  res.status(201).json(novo);
});

// DELETE /actividade-materiais/:id
atividadeMateriais.delete('/:id', (req, res) => {
  const db = getDb();
  const m = db.actividadeMateriais.find((x) => x.id === Number(req.params.id));
  if (!m) return res.status(404).json({ message: 'Pedido não encontrado' });
  m.activo = false;
  persist();
  res.json({ message: 'Pedido removido' });
});

export const atividadeMateriaisRouter = atividadeMateriais;
