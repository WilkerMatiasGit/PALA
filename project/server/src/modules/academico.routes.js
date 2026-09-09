import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

// ---- Disciplinas ----
const disciplinas = Router();
disciplinas.use(authRequired);

disciplinas.get('/', (req, res) => {
  const db = getDb();
  res.json(db.disciplinas.filter((x) => x.activo !== false));
});

disciplinas.post('/', rbac('admin'), (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ message: 'nome é obrigatório' });
  const db = getDb();
  if (db.disciplinas.some((d) => d.activo !== false && d.nome.toLowerCase() === String(nome).trim().toLowerCase())) {
    return res.status(409).json({ message: 'Já existe uma disciplina com este nome' });
  }
  const now = new Date().toISOString();
  const nova = { id: genId(), nome, activo: true, criado_em: now, actualizado_em: now };
  db.disciplinas.push(nova);
  persist();
  res.status(201).json(nova);
});

disciplinas.put('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const d = db.disciplinas.find((x) => x.id === Number(req.params.id));
  if (!d) return res.status(404).json({ message: 'Disciplina não encontrada' });
  if (req.body.nome !== undefined) d.nome = req.body.nome;
  d.actualizado_em = new Date().toISOString();
  persist();
  res.json(d);
});

disciplinas.delete('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const d = db.disciplinas.find((x) => x.id === Number(req.params.id));
  if (!d) return res.status(404).json({ message: 'Disciplina não encontrada' });
  d.activo = false;
  persist();
  res.json({ message: 'Disciplina removida' });
});

export const disciplinasRouter = disciplinas;

// ---- Curso-Disciplinas ----
const cursoDisciplinas = Router();
cursoDisciplinas.use(authRequired);

cursoDisciplinas.get('/', (req, res) => {
  const db = getDb();
  let result = db.cursoDisciplinas.filter((x) => x.activo !== false);
  if (req.query.curso_id) result = result.filter((x) => x.curso_id === Number(req.query.curso_id));
  res.json(result);
});

cursoDisciplinas.post('/', rbac('admin'), (req, res) => {
  const { curso_id, disciplina_id, semestre } = req.body || {};
  if (!curso_id || !disciplina_id || semestre == null) {
    return res.status(400).json({ message: 'curso_id, disciplina_id e semestre são obrigatórios' });
  }
  const db = getDb();
  const curso = db.cursos.find((c) => c.id === Number(curso_id));
  const disc = db.disciplinas.find((d) => d.id === Number(disciplina_id));
  if (db.cursoDisciplinas.some((cd) => cd.activo !== false && cd.curso_id === Number(curso_id) && cd.disciplina_id === Number(disciplina_id))) {
    return res.status(409).json({ message: 'Esta disciplina já está associada a este curso' });
  }
  const now = new Date().toISOString();
  const nova = {
    id: genId(),
    curso_id: Number(curso_id), curso_nome: curso?.nome ?? '',
    disciplina_id: Number(disciplina_id), disciplina_nome: disc?.nome ?? '',
    semestre: Number(semestre),
    activo: true, criado_em: now, actualizado_em: now,
  };
  db.cursoDisciplinas.push(nova);
  persist();
  res.status(201).json(nova);
});

cursoDisciplinas.delete('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const cd = db.cursoDisciplinas.find((x) => x.id === Number(req.params.id));
  if (!cd) return res.status(404).json({ message: 'Associação não encontrada' });
  cd.activo = false;
  persist();
  res.json({ message: 'Associação removida' });
});

export const cursoDisciplinasRouter = cursoDisciplinas;

// ---- Estudantes ----
const estudantes = Router();
estudantes.use(authRequired);

estudantes.get('/', (req, res) => {
  const db = getDb();
  res.json(db.estudantes.filter((x) => x.activo !== false));
});

estudantes.get('/:id', (req, res) => {
  const db = getDb();
  const e = db.estudantes.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
  res.json(e);
});

estudantes.post('/', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const { id, nome, curso_id } = req.body || {};
  if (!id || !nome || !curso_id) return res.status(400).json({ message: 'id (matrícula), nome e curso_id são obrigatórios' });
  const db = getDb();
  if (db.estudantes.some((e) => e.id === Number(id))) {
    return res.status(409).json({ message: 'Já existe um estudante com este número de matrícula' });
  }
  const curso = db.cursos.find((c) => c.id === Number(curso_id));
  const now = new Date().toISOString();
  const novo = {
    id: Number(id),
    nome, curso_id: Number(curso_id), curso_nome: curso?.nome ?? '',
    activo: true, criado_em: now, actualizado_em: now,
  };
  db.estudantes.push(novo);
  persist();
  res.status(201).json(novo);
});

estudantes.put('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const e = db.estudantes.find((x) => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
  const { nome, curso_id } = req.body || {};
  if (nome !== undefined) e.nome = nome;
  if (curso_id !== undefined) {
    e.curso_id = Number(curso_id);
    const curso = db.cursos.find((c) => c.id === Number(curso_id));
    e.curso_nome = curso?.nome ?? '';
  }
  e.actualizado_em = new Date().toISOString();
  persist();
  res.json(e);
});

estudantes.delete('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const e = db.estudantes.find((x) => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ message: 'Estudante não encontrado' });
  e.activo = false;
  persist();
  res.json({ message: 'Estudante removido' });
});

export const estudantesRouter = estudantes;
