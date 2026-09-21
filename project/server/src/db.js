import 'dotenv/config';
import mysql from 'mysql2/promise';
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
    connectTimeout: 10000,
    acquireTimeout: 15000,
  };
}

// Prisma ORM 7 exige um driver adapter para MySQL/MariaDB.
const adapter = new PrismaMariaDb(dbOptionsFromUrl(process.env.DATABASE_URL));

// Prisma client singleton — a fonte de dados real (MySQL).
export const prisma = new PrismaClient({ adapter });

async function warmUpMysql() {
  const u = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectTimeout: 10000,
  });
  await conn.query('SELECT 1');
  await conn.end();
}

export async function initDb() {
  await warmUpMysql();
  await prisma.$queryRaw`SELECT 1`;
  return prisma;
}