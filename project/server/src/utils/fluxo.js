// Fluxo de aprovação configurável (PLANO.md §3).
// Lê os passos da tabela fluxo_aprovacao; cai no padrão DLab→Supervisor se a
// tabela estiver vazia (backward-compatible com o comportamento original).
import { prisma } from '../db.js';

export const FLUXO_DEFAULT = [
  { nome: 'dlab', ordem: 1, cargos: ['coordenador_dlab', 'admin'] },
  { nome: 'supervisor', ordem: 2, cargos: ['supervisor', 'admin'] },
];

export async function obterFluxo() {
  const rows = await prisma.fluxoAprovacao.findMany({
    where: { activo: true },
    orderBy: { ordem: 'asc' },
  });
  if (rows.length === 0) return FLUXO_DEFAULT;
  return rows
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => ({
      nome: r.nome,
      ordem: r.ordem,
      cargos: Array.isArray(r.cargos) ? r.cargos : [],
    }));
}

// Cargos autorizados a votar numa etapa (admin é sempre permitido — super-usuário).
export async function cargosEtapa(etapa) {
  const fluxo = await obterFluxo();
  const passo = fluxo.find((p) => p.nome === etapa);
  const cargos = passo ? passo.cargos : FLUXO_DEFAULT.find((p) => p.nome === etapa)?.cargos ?? [];
  return cargos.includes('admin') ? cargos : [...cargos, 'admin'];
}

export async function podeVotarEtapa(etapa, tipo) {
  const cargos = await cargosEtapa(etapa);
  return cargos.includes(tipo);
}