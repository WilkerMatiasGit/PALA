// Sincroniza as sequências de auto-incremento (Postgres/Neon) com o MAX(id) de cada tabela.
// Necessário após seeds que inserem IDs explícitos — sem isto, o próximo INSERT (id autogerado)
// reutiliza um id já ocupado e falha com "Unique constraint failed on ..._pkey".
// Uso: node server/scripts/sync-sequences.js   (usa DATABASE_URL do .env na raiz)

import { prisma } from '../src/db.js';
import { pathToFileURL } from 'node:url';

const TABELA_RE = /^[a-z_][a-z0-9_]*$/;

export async function syncSequences(client = prisma) {
  const linhas = await client.$queryRawUnsafe(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = current_schema()
       AND tablename NOT LIKE 'prisma\\_%'`
  );

  const sincronizadas = [];
  for (const { tablename } of linhas) {
    if (!TABELA_RE.test(tablename)) continue;

    // Só tabelas com sequência própria na coluna id; tabelas vazias ficam intactas.
    const seq = await client.$queryRawUnsafe(
      `SELECT pg_get_serial_sequence('"${tablename}"', 'id') AS seq`
    );
    if (!seq?.[0]?.seq) continue;

    await client.$queryRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${tablename}"', 'id'), m, true)
       FROM (SELECT MAX(id) AS m FROM "${tablename}" HAVING MAX(id) IS NOT NULL) AS s`
    );
    sincronizadas.push(tablename);
  }
  return sincronizadas;
}

const isMain = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isMain) {
  syncSequences()
    .then((tabelas) => {
      console.log(`[sync-sequences] ${tabelas.length} tabelas sincronizadas: ${tabelas.join(', ')}`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('[sync-sequences] erro:', err.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}