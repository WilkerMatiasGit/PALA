// Helpers para resolver chaves de catálogo (nome) → id (PLANO.md §2.1).
// - unidade_laboratorial / categoria: lookup estrito (são CRUDs); devolvem null se não existirem.
// - unidade: upsert — o front continua a permitir texto livre; novas unidades entram no catálogo global.
import { prisma } from '../db.js';

export async function unidadeLaboratorialId(nome) {
  if (!nome) return null;
  const row = await prisma.unidadeLaboratorial.findFirst({ where: { nome, activo: true } });
  return row ? row.id : null;
}

export async function categoriaMaterialId(nome) {
  if (!nome) return null;
  const row = await prisma.categoriaMaterial.findFirst({ where: { nome, activo: true } });
  return row ? row.id : null;
}

export async function unidadeId(nome) {
  if (!nome) return null;
  const row = await prisma.unidade.findFirst({ where: { nome, activo: true } });
  if (row) return row.id;
  const criada = await prisma.unidade.create({ data: { nome } });
  return criada.id;
}