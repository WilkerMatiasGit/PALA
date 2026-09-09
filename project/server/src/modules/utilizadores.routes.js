import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { hashSenha } from '../utils/hash.js';
import { authRequired, rbac } from '../middleware/auth.js';

const router = Router();

function emailValido(email) {
  return typeof email === 'string' && /^[^@\s]+@isptec\.co\.ao$/.test(email.trim().toLowerCase());
}

function toUserGet(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    tipo: u.tipo,
    criado_em: u.criado_em,
    actualizado_em: u.actualizado_em,
  };
}

router.use(authRequired);

// GET /user — listar (A)
router.get('/', rbac('admin'), (req, res) => {
  const db = getDb();
  res.json(db.utilizadores.filter((u) => u.activo !== false).map(toUserGet));
});

// GET /user/tecnicos — listar apenas utilizadores técnicos (roles do fluxo de aprovação) [definir ANTES de /:id]
router.get('/tecnicos', rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  res.json(db.utilizadores.filter((u) => u.activo !== false && u.tipo === 'tecnico').map(toUserGet));
});

// GET /user/:id — obter (A)
router.get('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const u = db.utilizadores.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
  res.json(toUserGet(u));
});

// POST /user — criar (A)
router.post('/', rbac('admin'), async (req, res, next) => {
  try {
    const { nome, email, tipo, senha } = req.body || {};
    if (!nome || !email || !tipo) {
      return res.status(400).json({ message: 'nome, email e tipo são obrigatórios' });
    }
    if (!emailValido(email)) {
      return res.status(400).json({ message: 'Email deve pertencer ao domínio @isptec.co.ao' });
    }
    const db = getDb();
    if (db.utilizadores.some((u) => u.email === email)) {
      return res.status(409).json({ message: 'Email já registado' });
    }
    const now = new Date().toISOString();
    const senhaHash = await hashSenha(senha || '12345678');
    const novo = {
      id: genId(),
      nome,
      email,
      senha_hash: senhaHash,
      tipo,
      activo: true,
      criado_em: now,
      actualizado_em: now,
    };
    db.utilizadores.push(novo);
    persist();
    res.status(201).json(toUserGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /user/reset-password — repor senha (A)  [definir ANTES de /:id]
router.put('/reset-password', rbac('admin'), async (req, res, next) => {
  try {
    const { id, nova_senha } = req.body || {};
    const db = getDb();
    const u = db.utilizadores.find((x) => x.id === Number(id));
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    u.senha_hash = await hashSenha(nova_senha || '12345678');
    u.actualizado_em = new Date().toISOString();
    persist();
    res.json({ message: 'Senha reposta' });
  } catch (err) {
    next(err);
  }
});

// PUT /user/:id — atualizar.
// Admin: edita qualquer utilizador (nome/email/tipo/senha).
// Utilizador comum: só a si próprio, e apenas nome/senha (o cargo/email só o Admin altera — RF do perfil).
router.put('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const targetId = Number(req.params.id);
    const u = db.utilizadores.find((x) => x.id === targetId);
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    const { nome, email, tipo, senha } = req.body || {};
    const isAdmin = req.user.tipo === 'admin';
    if (!isAdmin && req.user.id !== targetId) {
      return res.status(403).json({ message: 'Não pode editar este utilizador' });
    }
    if (nome !== undefined) {
      if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ message: 'nome inválido' });
      u.nome = nome;
    }
    if (!isAdmin) {
      // não-admin: só nome/senha; ignora email/tipo vindos no payload
      if (senha !== undefined && senha !== '') u.senha_hash = await hashSenha(senha);
    } else {
      if (email !== undefined) u.email = email;
      if (tipo !== undefined) u.tipo = tipo;
      if (senha !== undefined && senha !== '') u.senha_hash = await hashSenha(senha);
    }
    u.actualizado_em = new Date().toISOString();
    persist();
    res.json(toUserGet(u));
  } catch (err) {
    next(err);
  }
});

// DELETE /user/:id — soft delete (A)
router.delete('/:id', rbac('admin'), (req, res) => {
  const db = getDb();
  const u = db.utilizadores.find((x) => x.id === Number(req.params.id));
  if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
  u.activo = false;
  persist();
  res.json({ message: 'Utilizador removido' });
});

export default router;
