import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import {
  toAulaGet,
  toVisitaGet,
  toProjectoGet,
  toEstagioGet,
} from '../utils/dto.js';
import { alterarComPermissao } from '../utils/actividade_permissao.js';

const ACT_ROLES = ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'];

const cdInclude = { curso_disciplina: { include: { curso: true, disciplina: true } } };

// ---- Aulas ----
const aulas = Router();
aulas.use(authRequired);

// POST /aulas — upsert por atividade (cria se não existir, atualiza se existir)
aulas.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, curso_disciplina_id, tema, turno, numero_turma } = req.body || {};
    if (!actividade_id || !curso_disciplina_id) {
      return res.status(400).json({ message: 'actividade_id e curso_disciplina_id são obrigatórios' });
    }
    const normTurno = turno === 'manha' || turno === 'tarde' ? turno : null;
    const normNumero = Number.isInteger(numero_turma) ? numero_turma : Number(numero_turma);
    const finalNumero = Number.isInteger(normNumero) && normNumero > 0 ? normNumero : null;
    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    // Regras 1 (estado) + 2 (autoria).
    const result = await alterarComPermissao(act, req.user, (tx) => tx.aula.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        curso_disciplina_id: Number(curso_disciplina_id),
        tema: tema || '',
        turno: normTurno,
        numero_turma: finalNumero,
      },
      create: {
        actividade_id: Number(actividade_id),
        curso_disciplina_id: Number(curso_disciplina_id),
        tema: tema || '',
        turno: normTurno,
        numero_turma: finalNumero,
      },
      include: cdInclude,
    }));
    res.status(200).json(toAulaGet(result));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
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
    const tel = String(telefone).replace(/\s/g, '');
    if (!/^[0-9]{9}$/.test(tel)) {
      return res.status(400).json({ message: 'Telefone inválido (9 dígitos)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ message: 'Email inválido' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    // Regras 1 (estado) + 2 (autoria).
    const result = await alterarComPermissao(act, req.user, (tx) => tx.visita.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        nome_visitante,
        ...(instituicao ? { instituicao } : {}),
        telefone: tel,
        email: String(email),
      },
      create: {
        actividade_id: Number(actividade_id),
        nome_visitante,
        ...(instituicao ? { instituicao } : {}),
        telefone: tel,
        email: String(email),
      },
    }));
    res.status(200).json(toVisitaGet(result));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  }
});

export const visitasRouter = visitas;

// ---- Projectos ----
const projectos = Router();
projectos.use(authRequired);

projectos.post('/', rbac(...ACT_ROLES), async (req, res, next) => {
  try {
    const { actividade_id, titulo, descricao, data_inicio, data_fim } = req.body || {};
    if (!actividade_id || !titulo || !data_inicio || !data_fim) {
      return res.status(400).json({ message: 'actividade_id, titulo, data_inicio e data_fim são obrigatórios' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    // Regras 1 (estado) + 2 (autoria).
    const result = await alterarComPermissao(act, req.user, (tx) => tx.projecto.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        titulo,
        descricao: descricao || '',
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      create: {
        actividade_id: Number(actividade_id),
        titulo,
        descricao: descricao || '',
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
    }));
    res.status(200).json(toProjectoGet(result));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
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
    const { actividade_id, estudante_id, data_inicio, data_fim } = req.body || {};
    if (!actividade_id || estudante_id == null || !data_inicio || !data_fim) {
      return res.status(400).json({ message: 'actividade_id, estudante_id, data_inicio e data_fim são obrigatórios' });
    }
    const estId = Number(estudante_id);
    if (!Number.isInteger(estId) || estId < 1) {
      return res.status(400).json({ message: 'estudante_id inválido' });
    }
    const est = await prisma.estudante.findUnique({ where: { id: estId } });
    if (!est || !est.activo) {
      return res.status(400).json({ message: 'Estudante não encontrado ou inactivo' });
    }
    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });
    // Regras 1 (estado) + 2 (autoria).
    const result = await alterarComPermissao(act, req.user, (tx) => tx.estagio.upsert({
      where: { actividade_id: Number(actividade_id) },
      update: {
        estudante_id: estId,
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      create: {
        actividade_id: Number(actividade_id),
        estudante_id: estId,
        data_inicio: new Date(data_inicio),
        data_fim: new Date(data_fim),
      },
      include: { estudante: true },
    }));
    res.status(200).json(toEstagioGet(result));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
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
      include: { estudante: true },
    });
    res.json(toEstagioGet(atualizado));
  } catch (err) {
    next(err);
  }
});

export const estagiosRouter = estagios;
