import fs from 'node:fs';
import path from 'node:path';
import { DATA_FILE } from './config.js';
import { buildSeed } from './seed.js';

// Data store in-memory (esta é a fonte de verdade durante runtime).
// Persistida em DATA_FILE para survive a restarts. É recriada a partir do seed
// se o ficheiro não existir.
let db = null;

function loadFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[db] Falha ao ler ficheiro de dados; a recriar a partir do seed.', err.message);
  }
  return null;
}

export function initDb() {
  const loaded = loadFromDisk();
  db = loaded && loaded.meta && loaded.meta.seedVersion ? loaded : buildSeed();
  persist();
  return db;
}

export function persist() {
  if (!db) return;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('[db] Falha ao persistir dados.', err.message);
  }
}

export function getDb() {
  if (!db) initDb();
  return db;
}

export function genId() {
  return ++db.nextId;
}

// Reinicia a base para o seed (útil em dev). Devolve true se foi feito.
export function resetDb() {
  db = buildSeed();
  persist();
  return true;
}
