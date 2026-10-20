// Seed parcial e idempotente das configurações gerais (tabela `configuracoes_gerais`).
// Garante a linha única (id 1) sem tocar numa linha que já exista e sem resetar nada.
// Também corre no arranque do backend (initDb).
// Uso: node server/scripts/seed-configuracao.js

import { prisma, ensureConfiguracaoGeral, CONFIGURACAO_GERAL_ID } from '../src/db.js';

ensureConfiguracaoGeral()
  .then(async () => {
    const row = await prisma.configuracaoGeral.findUnique({ where: { id: CONFIGURACAO_GERAL_ID } });
    console.log(`[seed-configuracao] configurações gerais garantidas (id=${row.id}, permitir_fim_semana=${row.permitir_fim_semana})`);
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[seed-configuracao] erro:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
