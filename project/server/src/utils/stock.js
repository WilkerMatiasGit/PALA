import { getDb } from '../db.js';

// RF17: a quantidade de um material é sempre o SUM das movimentações registadas.
// Esta função recalcula e devolve a soma para o material dado.
export function stockActual(materialId) {
  const db = getDb();
  return db.historico
    .filter((h) => h.material_id === materialId && h.activo !== false)
    .reduce((sum, h) => sum + Number(h.quantidade_movimentada || 0), 0);
}

// Recalcula e persiste a quantidade desnormalizada de um material a partir do histórico.
export function recomputeMaterial(materialId) {
  const db = getDb();
  const mat = db.materiais.find((m) => m.id === materialId);
  if (!mat) return;
  mat.quantidade = stockActual(materialId);
  mat.actualizado_em = new Date().toISOString();
}
