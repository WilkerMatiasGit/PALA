// Helpers para resolver chaves de catálogo (nome) → id (PLANO.md §2.1).
// - unidade_laboratorial / categoria: lookup estrito (são CRUDs); devolvem null se não existirem.
// - unidade: fallback de upsert — a UI já cria via catálogo (SearchSelect); se chegar aqui um
//   nome activo devolve o id, se existir inactivo reactiva-o, senão cria.
import { prisma } from '../db.js';

export async function unidadeLaboratorialId(nome) {
  if (!nome) return null;
  const n = String(nome).trim();
  const row = await prisma.unidadeLaboratorial.findFirst({
    where: { nome: { equals: n, mode: 'insensitive' }, activo: true },
  });
  return row ? row.id : null;
}

export async function categoriaMaterialId(nome) {
  if (!nome) return null;
  const n = String(nome).trim();
  const row = await prisma.categoriaMaterial.findFirst({
    where: { nome: { equals: n, mode: 'insensitive' }, activo: true },
  });
  return row ? row.id : null;
}

export async function unidadeId(nome) {
  if (!nome) return null;
  const n = String(nome).trim();
  const existente = await prisma.unidade.findFirst({
    where: { nome: { equals: n, mode: 'insensitive' } },
  });
  if (existente) {
    if (!existente.activo) {
      await prisma.unidade.update({ where: { id: existente.id }, data: { activo: true } });
    }
    return existente.id;
  }
  const criada = await prisma.unidade.create({ data: { nome: n } });
  return criada.id;
}
