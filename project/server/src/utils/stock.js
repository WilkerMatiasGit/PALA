import { prisma } from '../db.js';

// RF17: a quantidade de um material é sempre o SUM das movimentações registadas.
// Devolve a soma agregada no MySQL (fonte da verdade).
export async function stockActual(materialId) {
  const agg = await prisma.historicoMaterial.aggregate({
    _sum: { quantidade_movimentada: true },
    where: { material_id: Number(materialId), activo: true },
  });
  return agg._sum.quantidade_movimentada ?? 0;
}

// Recalcula e persiste a quantidade desnormalizada de um material a partir do histórico.
// Aceita um client de transação para ser usado dentro de prisma.$transaction.
export async function recomputeMaterial(materialId, client = prisma) {
  const agg = await client.historicoMaterial.aggregate({
    _sum: { quantidade_movimentada: true },
    where: { material_id: Number(materialId), activo: true },
  });
  const qty = agg._sum.quantidade_movimentada ?? 0;
  return client.material.update({
    where: { id: Number(materialId) },
    data: { quantidade: qty },
  });
}