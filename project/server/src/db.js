import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma ORM 7 exige um driver adapter. Com provider único `postgresql`
// (dev Postgres local/Docker e staging Neon usam todos URLs `postgres://`);
// a POOLED connection string da Neon é compatível com o adapter-pg.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL em falta. Define `postgresql://...` no .env (raiz do projeto).');
}

// Prisma client singleton — a fonte de dados real (Postgres / Neon).
const adapter = new PrismaPg({ connectionString: connectionString.replace(/^postgres:/, 'postgresql:') });
export const prisma = new PrismaClient({ adapter });

// Tipos de atividade com limite de participantes configurável (tabela `limites_participantes`).
export const TIPOS_ACTIVIDADE = ['aula', 'visita', 'projecto', 'estagio'];

// Garante que existem as 4 linhas de limite (idempotente, sem tocar nas existentes).
// Corre no arranque do backend para a base nunca ficar sem configuração base.
export async function ensureLimitesParticipantes(client = prisma) {
  await client.limiteParticipantes.createMany({
    data: TIPOS_ACTIVIDADE.map((tipo) => ({ tipo, min: 1, max: 40, limite_activo: false })),
    skipDuplicates: true,
  });
}

export async function initDb() {
  await prisma.$queryRaw`SELECT 1`;
  await ensureLimitesParticipantes();
  return prisma;
}