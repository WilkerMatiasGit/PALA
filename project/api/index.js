// Vercel Function (serverless) — expõe o Express DLab sob `/api`.
// A função recebe o URL original com o prefixo `/api` (rewrite em vercel.json);
// o Express do backend está montado na raiz (`/`, `/user`, `/labs`, ...).
import app from '../server/src/app.js';

export default function handler(req, res) {
  if (req.url && req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }
  return app(req, res);
}