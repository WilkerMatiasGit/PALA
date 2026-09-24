// Deploy DLab → Vercel:
//   1. migrações Prisma (migrate deploy)
//   2. gera Prisma Client
//   3. deploy Vercel em produção
// Pede VERCEL_TOKEN no .env (raiz). Pode ser executado de CI também.
import 'dotenv/config';
import path from 'node:path';
import { spawn } from 'node:child_process';

const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`)),
    );
  });

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error('[deploy] Falta VERCEL_TOKEN no .env (raiz do projeto).');
  process.exit(1);
}
console.log('[deploy] 1/3 migrações Prisma (migrate deploy)...');
await run(npm, ['run', 'migrate:deploy'], { shell: win });
console.log('[deploy] 2/3 gerar Prisma Client...');
await run(npm, ['run', 'db:generate'], { shell: win });
console.log('[deploy] 3/3 vercel deploy --prod...');
// Invoca o CLI da Vercel via node (evita problemas de shell/path com espaços).
// O token passa pela variável VERCEL_TOKEN (nunca por argumentos de processo).
const vercelMain = path.join(process.cwd(), 'node_modules', 'vercel', 'dist', 'index.js');
await run(process.execPath, [vercelMain, 'deploy', '--prod', '--yes'], {
  env: { ...process.env, VERCEL_TOKEN: token },
});
console.log('[deploy] Concluído.');