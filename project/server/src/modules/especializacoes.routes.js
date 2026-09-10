import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import {
  toAulaGet,
  toVisitaGet,
  toProjectoGet,
  toEstagioGet,
  toActividadeTecnicoGet,
  toActividadeMaterialGet,
} from '../utils/dto.js';

const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const cdInclude = { curso_disciplina: { include: { curso: true, disciplina: true } } };

// ---- Aulas ----
const aulas = Router();
aulas.use(authRequired);

// POST /aulas — upsert por atividade (cria se não existir, atualiza se existir)
aulas.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, curso_disciplina_id, tema } = req.body || {};
    if (!actividade_id || !curso_disciplina_id) {
      return res.status(400).json({ message: 'actividade_id e curso_disciplina_id são obrigatórios' });
    }
    const result = await prisma.aula.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: { curso_disciplina_id: Number(curso_disciplina_id), tema: tema || '' },
      create: {
        actividade_id: Number(actividade_id),
        curso_disciplina_id: Number(curso_disciplina_id),
        tema: tema || '',
      },
      include: cdInclude,
    });
    res.status(200).json(toAulaGet(result));
  } catch (err) {
    next(err);
  }
});

export const aulasRouter = aulas;

// ---- Visitas ----
const visitas = Router();
visitas.use(authRequired);

visitas.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, nome_visitante, instituicao, telefone, email } = req.body || {};
    if (!actividade_id || !nome_visitante || !telefone || !email) {
      return res.status(400).json({ message: 'actividade_id, nome_visitante, telefone e email são obrigatórios' });
    }
    const result = await prisma.visita.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        nome_visitante,
        ...(instituicao ? { instituicao } : {}),
        telefone,
        email,
      },
      create: {
        actividade_id: Number(actividade_id),
        nome_visitante,
        ...(instituicao ? { instituicao } : {}),
        telefone,
        email,
      },
    });
    res.status(200).json(toVisitaGet(result));
  } catch (err) {
    next(err);
  }
});

export const visitasRouter = visitas;

// ---- Projectos ----
const projectos = Router();
projectos.use(authRequired);

projectos.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, responsavel_id, titulo, descricao, data_inicio, data_fim } = req.body || {};
    if (!actividade_id || !responsavel_id || !titulo || !data_inicio || !data_fim) {
      return res.status(400).json({ message: 'actividade_id, responsavel_id, titulo, data_inicio e data_fim são obrigatórios' });
    }
    const result = await prisma.projecto.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        responsavel_id: Number(responsavel_id),
        titulo,
        descricao: descricao || '',
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      create: {
        actividade_id: Number(actividade_id),
        responsavel_id: Number(responsavel_id),
        titulo,
        descricao: descricao || '',
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      include: { responsavel: true },
    });
    res.status(200).json(toProjectoGet(result));
  } catch (err) {
    next(err);
  }
});

// PUT /projectos/:id/documento — submeter anexo (pós-conclusão)
projectos.put('/:id/documento', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const p = await prisma.projecto.findUnique({ where: { id: Number(req.params.id) } });
    if (!p) return res.status(404).json({ message: 'Projeto não encontrado' });
    const { anexo_path } = req.body || {};
    if (!anexo_path) return res.status(400).json({ message: 'anexo_path é obrigatório' });
    const atualizado = await prisma.projecto.update({
      where: { id: p.id },
      data: { anexo_path },
      include: { responsavel: true },
    });
    res.json(toProjectoGet(atualizado));
  } catch (err) {
    next(err);
  }
});

export const projectosRouter = projectos;

// ---- Estágios ----
const estagios = Router();
estagios.use(authRequired);

estagios.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, responsavel_id, estudante_id, data_inicio, data_fim } = req.body || {};
    if (!actividade_id || !responsavel_id || !estudante_id || !data_inicio || !data_fim) {
      return res.status(400).json({ message: 'actividade_id, responsavel_id, estudante_id, data_inicio e data_fim são obrigatórios' });
    }
    const result = await prisma.estagio.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        responsavel_id: Number(responsavel_id),
        estudante_id: Number(estudante_id),
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      create: {
        actividade_id: Number(actividade_id),
        responsavel_id: Number(responsavel_id),
        estudante_id: Number(estudante_id),
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      include: { responsavel: true, estudante: true },
    });
    res.status(200).json(toEstagioGet(result));
  } catch (err) {
    next(err);
  }
});

// PUT /estagios/:id/documento — submeter anexo (pós-conclusão)
estagios.put('/:id/documento', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const e = await prisma.estagio.findUnique({ where: { id: Number(req.params.id) } });
    if (!e) return res.status(404).json({ message: 'Estágio não encontrado' });
    const { anexo_path } = req.body || {};
    if (!anexo_path) return res.status(400).json({ message: 'anexo_path é obrigatório' });
    const atualizado = await prisma.estagio.update({
      where: { id: e.id },
      data: { anexo_path },
      include: { responsavel: true, estudante: true },
    });
    res.json(toEstagioGet(atualizado));
  } catch (err) {
    next(err);
  }
});

export const estagiosRouter = estagios;

// ---- Actividade-Técnico ----
const atividadeTecnico = Router();
atividadeTecnico.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor'));

// POST /actividade-tecnico — atribuir técnico (validador) ou assistente
atividadeTecnico.post('/', async (req, res, next) => {
  try {
    const { actividade_id, utilizador_id, papel } = req.body || {};
    if (!actividade_id || !utilizador_id || !papel) {
      return res.status(400).json({ message: 'actividade_id, utilizador_id e papel são obrigatórios' });
    }
    const result = await prisma.actividadeTecnico.upsert({
      where: { atividade_id_papel: { actividade_id: Number(actividade_id), papel } },
      update: { utilizador_id: Number(utilizador_id) },
      create: {
        actividade_id: Number(actividade_id),
        utilizador_id: Number(utilizador_id),
        papel,
      },
      include: { utilizador: true },
    });
    res.status(201).json(toActividadeTecnicoGet(result));
  } catch (err) {
    next(err);
  }
});

// DELETE /actividade-tecnico/:id
atividadeTecnico.delete('/:id', async (req, res, next) => {
  try {
    const t = await prisma.actividadeTecnico.findUnique({ where: { id: Number(req.params.id) } });
    if (!t) return res.status(404).json({ message: 'Atribuição não encontrada' });
    await prisma.actividadeTecnico.update({ where: { id: t.id }, data: { activo: false } });
    res.json({ message: 'Atribuição removida' });
  } catch (err) {
    next(err);
  }
});

export const atividadeTecnicoRouter = atividadeTecnico;

// ---- Actividade-Materiais ----
const atividadeMateriais = Router();
atividadeMateriais.use(authRequired, rbac(...ACT_ROLES));

// POST /actividade-materiais
atividadeMateriais.post('/', async (req, res, next) => {
  try {
    const { actividade_id, material_id, quantidade_estimada } = req.body || {};
    if (!actividade_id || !material_id || quantidade_estimada == null) {
      return res.status(400).json({ message: 'actividade_id, material_id e quantidade_estimada são obrigatórios' });
    }
    const result = await prisma.actividadeMaterial.upsert({
      where: { atividade_id_material_id: { actividade_id: Number(actividade_id), material_id: Number(material_id) } },
      update: { quantidade_estimada: Number(quantidade_estimada) },
      create: {
        actividade_id: Number(actividade_id),
        material_id: Number(material_id),
        quantidade_estimada: Number(quantidade_estimada),
      },
      include: { material: true },
    });
    res.status(201).json(toActividadeMaterialGet(result));
  } catch (err) {
    next(err);
  }
});

// DELETE /actividade-materiais/:id
atividadeMateriais.delete('/:id', async (req, res, next) => {
  try {
    const m = await prisma.actividadeMaterial.findUnique({ where: { id: Number(req.params.id) } });
    if (!m) return res.status(404).json({ message: 'Pedido não encontrado' });
    await prisma.actividadeMaterial.update({ where: { id: m.id }, data: { activo: false } });
    res.json({ message: 'Pedido removido' });
  } catch (err) {
    next(err);
  }
});

export const atividadeMateriaisRouter = atividadeMateriais;