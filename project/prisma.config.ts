// Prisma ORM 7: a ligação à base é configurada aqui (não no datasource do schema).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  migrations: {
    path: 'server/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Neon: URL directa (sem pooler) só para migrações, quando presente.
    ...(process.env.DIRECT_URL ? { directUrl: process.env.DIRECT_URL } : {}),
  },
});