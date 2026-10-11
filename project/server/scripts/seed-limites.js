// Seed parcial e idempotente dos limites de participantes (tabela `limites_participantes`).
// Cria apenas as linhas em falta (aula/visita/projecto/estagio) sem tocar nas existentes
// e sem resetar nada. Também corre no arranque do backend (initDb).
// Uso: node server/scripts/seed-limites.js

import { prisma, ensureLimitesParticipantes } from '../src/db.js';

ensureLimitesParticipantes()
  .then(async () => {
    const rows = await prisma.limiteParticipantes.findMany({ orderBy: { id: 'asc' } });
    console.log(`[seed-limites] limites garantidos (${rows.length}):`, rows.map((r) => `${r.tipo}(min=${r.min},max=${r.max},activo=${r.limite_activo})`).join(' '));
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[seed-limites] erro:', err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
