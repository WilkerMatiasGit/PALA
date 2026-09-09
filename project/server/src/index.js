import app from './app.js';
import { PORT } from './config.js';
import { getDb } from './db.js';

const server = app.listen(PORT, () => {
  const db = getDb();
  console.log(`\n[DLab API] a escutar em http://localhost:${PORT}`);
  console.log(`[DLab API] ${db.utilizadores.length} utilizadores | ${db.actividades.length} actividades | ${db.materiais.length} materiais`);
  console.log('[DLab API] Dev login: qualquer email do seed com senha 12345678\n');
});

export default server;
