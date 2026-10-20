import { prisma, CONFIGURACAO_GERAL_ID } from '../db.js';

// Valores por defeito, aplicados quando a linha única ainda não existe (ex.: base
// recém-criada antes do primeiro arranque). Mantém-se em sincronia com os defaults
// do schema (`permitir_fim_semana=false`).
export const CONFIGURACAO_GERAL_DEFAULT = {
  permitir_fim_semana: false,
};

// Lê a configuração geral do sistema (linha única, id fixo). Devolve os defaults
// quando a linha falta. É lida UMA vez por pedido e reutilizada em todas as sessões.
export async function obterConfiguracaoGeral(client = prisma) {
  const row = await client.configuracaoGeral.findUnique({ where: { id: CONFIGURACAO_GERAL_ID } });
  if (!row) return { ...CONFIGURACAO_GERAL_DEFAULT };
  return {
    // Colunas futuras (feriados, antecedência, prazo de confirmação) são acrescentadas aqui.
    permitir_fim_semana: row.permitir_fim_semana,
  };
}
