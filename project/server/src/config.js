import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dlab-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '12h';
export const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
