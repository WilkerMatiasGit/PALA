import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function dbOptionsFromUrl(url) {
  const u = new URL(url);
  const connectionLimit = Number(u.searchParams.get('connection_limit')) || 5;
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit,
  };
}

// Prisma ORM 7 exige um driver adapter para MySQL/MariaDB.
const adapter = new PrismaMariaDb(dbOptionsFromUrl(process.env.DATABASE_URL));

// Prisma client singleton — a fonte de dados real (MySQL).
export const prisma = new PrismaClient({ adapter });

// Verifica a ligação à base no arranque (falha rápido se .env não estiver configurado).
export async function initDb() {
  await prisma.$queryRaw`SELECT 1`;
  return prisma;
}