// Catálogos (PLANO.md §2.1): UnidadeLaboratorial, CategoriaMaterial, Unidade.
// Leitura autenticada; escrita apenas Admin.
import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

function toCatalogoGet(row, extra = {}) {
  return {
    id: row.id,
    nome: row.nome,
    ...extra,
    criado_em: row.criado_em,
    actualizado_em: row.actualizado_em,
  };
}

function criarRouter({ model, uniqueKey, nomeLabel, usoQuery, usoNome, usoPlural, usoAlvo }) {
  const r = Router();
  r.use(authRequired);

  const KEY = uniqueKey; // ex.: 'laboratorios' | 'materiais' (contagem de uso)
  const NOME = nomeLabel;

  const textoUso = (uso) => `${uso === 1 ? usoNome : usoPlural}`;
  const mensagemUso = (uso) =>
    `Não é possível eliminar — está em uso por ${uso} ${textoUso(uso)}. ` +
    `Reatribui ${uso === 1 ? 'esse' : 'esses'} ${textoUso(uso)} a ${usoAlvo} primeiro.`;

  r.get('/', async (req, res, next) => {
    try {
      const rows = await prisma[model].findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
      res.json(rows.map((row) => toCatalogoGet(row)));
    } catch (err) {
      next(err);
    }
  });

  r.post('/', rbac('admin'), async (req, res, next) => {
    try {
      const { nome, descricao } = req.body || {};
      if (!nome) return res.status(400).json({ message: `${NOME} nome é obrigatório` });
      const nomeTrim = String(nome).trim();
      const dup = await prisma[model].findFirst({
        where: { nome: { equals: nomeTrim, mode: 'insensitive' } },
      });
      if (dup) {
        if (dup.activo) return res.status(409).json({ message: `${NOME} já existe` });
        // Nome pertence a um registo soft-deleted: reactiva-o (e actualiza os
        // campos enviados) em vez de colidir com a unicidade.
        const reactivado = await prisma[model].update({
          where: { id: dup.id },
          data: { activo: true, ...(descricao !== undefined ? { descricao } : {}) },
        });
        return res.status(200).json(toCatalogoGet(reactivado));
      }
      const row = await prisma[model].create({
        data: { nome: nomeTrim, ...(descricao !== undefined ? { descricao } : {}) },
      });
      res.status(201).json(toCatalogoGet(row));
    } catch (err) {
      next(err);
    }
  });

  r.put('/:id', rbac('admin'), async (req, res, next) => {
    try {
      const row = await prisma[model].findUnique({ where: { id: Number(req.params.id) } });
      if (!row) return res.status(404).json({ message: `${NOME} não encontrado` });
      const { nome, descricao } = req.body || {};
      const data = {};
      if (nome !== undefined) {
        const dup = await prisma[model].findFirst({
          where: { nome: { equals: String(nome).trim(), mode: 'insensitive' }, NOT: { id: row.id } },
        });
        if (dup) return res.status(409).json({ message: `${NOME} já existe` });
        data.nome = String(nome).trim();
      }
      if (descricao !== undefined) data.descricao = descricao;
      const at = await prisma[model].update({ where: { id: row.id }, data });
      res.json(toCatalogoGet(at));
    } catch (err) {
      next(err);
    }
  });

  r.delete('/:id', rbac('admin'), async (req, res, next) => {
    try {
      const row = await prisma[model].findUnique({ where: { id: Number(req.params.id) } });
      if (!row) return res.status(404).json({ message: `${NOME} não encontrado` });
      const uso = await prisma[KEY].count({ where: { [usoQuery]: row.id, activo: true } });
      if (uso > 0) {
        return res.status(409).json({ message: mensagemUso(uso) });
      }
      await prisma[model].update({ where: { id: row.id }, data: { activo: false } });
      res.json({ message: `${NOME} removido` });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

export const unidadesLaboratoriaisRouter = criarRouter({
  model: 'unidadeLaboratorial',
  uniqueKey: 'laboratorio',
  nomeLabel: 'Unidade laboratorial',
  usoQuery: 'unidade_laboratorial_id', // attn: count on Laboratorio uses field name
  usoNome: 'laboratório',
  usoPlural: 'laboratórios',
  usoAlvo: 'outra unidade laboratorial',
});

export const categoriasMaterialRouter = criarRouter({
  model: 'categoriaMaterial',
  uniqueKey: 'material',
  nomeLabel: 'Categoria de material',
  usoQuery: 'categoria_id',
  usoNome: 'material',
  usoPlural: 'materiais',
  usoAlvo: 'outra categoria',
});

export const unidadesRouter = criarRouter({
  model: 'unidade',
  uniqueKey: 'material',
  nomeLabel: 'Unidade',
  usoQuery: 'unidade_id',
  usoNome: 'material',
  usoPlural: 'materiais',
  usoAlvo: 'outra unidade',
});