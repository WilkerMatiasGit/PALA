import app from './app.js';
import { PORT } from './config.js';
import { initDb, prisma } from './db.js';

// Liga à base antes de aceitar pedidos (falha rápido com .env mal configurado)
initDb()
  .then(async () => {
    const [users, actividades, materiais] = await Promise.all([
      prisma.utilizador.count(),
      prisma.actividade.count(),
      prisma.material.count(),
    ]);
    const server = app.listen(PORT, () => {
      console.log(`\n[DLab API] a escutar em http://localhost:${PORT}`);
      console.log(`[DLab API] ${users} utilizadores | ${actividades} actividades | ${materiais} materiais`);
      console.log('[DLab API] Dev login: qualquer email do seed com senha 12345678\n');
    });
    return server;
  })
  .catch((err) => {
    console.error('[DLab API] Falha ao ligar à base de dados:', err.message);
    let cause = err.cause;
    let depth = 0;
    while (cause && depth < 5) {
      console.error(`[DLab API] causa (${++depth}):`, cause.message ?? cause);
      cause = cause.cause;
    }
    if (err.errors?.length) console.error('[DLab API] erros internos:', err.errors);
    console.error('[DLab API] Verifica o DATABASE_URL no .env (raiz do projeto) e que o MySQL está a correr.');
    process.exit(1);
  });