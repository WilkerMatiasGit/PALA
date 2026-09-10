import { Router } from 'express';
import { prisma } from '../db.js';
import { hashSenha } from '../utils/hash.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toUserGet } from '../utils/dto.js';

const router = Router();

function emailValido(email) {
  return typeof email === 'string' && /^[^@\s]+@isptec\.co\.ao$/.test(email.trim().toLowerCase());
}

router.use(authRequired);

// GET /user — listar (A)
router.get('/', rbac('admin'), async (req, res, next) => {
  try {
    const users = await prisma.utilizador.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    res.json(users.map(toUserGet));
  } catch (err) {
    next(err);
  }
});

// GET /user/tecnicos — listar apenas utilizadores técnicos (roles do fluxo de aprovação) [definir ANTES de /:id]
router.get('/tecnicos', rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const users = await prisma.utilizador.findMany({ where: { activo: true, tipo: 'tecnico' }, orderBy: { id: 'asc' } });
    res.json(users.map(toUserGet));
  } catch (err) {
    next(err);
  }
});

// GET /user/:id — obter (A)
router.get('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const u = await prisma.utilizador.findFirst({ where: { id: Number(req.params.id), activo: true } });
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    res.json(toUserGet(u));
  } catch (err) {
    next(err);
  }
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
    const existing = await prisma.utilizador.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email já registado' });
    }
    const senhaHash = await hashSenha(senha || '12345678');
    const novo = await prisma.utilizador.create({
      data: { nome, email, senha_hash: senhaHash, tipo },
    });
    res.status(201).json(toUserGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /user/reset-password — repor senha (A)  [definir ANTES de /:id]
router.put('/reset-password', rbac('admin'), async (req, res, next) => {
  try {
    const { id, nova_senha } = req.body || {};
    const u = await prisma.utilizador.findUnique({ where: { id: Number(id) } });
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    const senhaHash = await hashSenha(nova_senha || '12345678');
    await prisma.utilizador.update({ where: { id: u.id }, data: { senha_hash: senhaHash } });
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
    const targetId = Number(req.params.id);
    const u = await prisma.utilizador.findUnique({ where: { id: targetId } });
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    const { nome, email, tipo, senha } = req.body || {};
    const isAdmin = req.user.tipo === 'admin';
    if (!isAdmin && req.user.id !== targetId) {
      return res.status(403).json({ message: 'Não pode editar este utilizador' });
    }
    const data = {};
    if (nome !== undefined) {
      if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ message: 'nome inválido' });
      data.nome = nome;
    }
    if (!isAdmin) {
      // não-admin: só nome/senha; ignora email/tipo vindos no payload
      if (senha !== undefined && senha !== '') data.senha_hash = await hashSenha(senha);
    } else {
      if (email !== undefined) data.email = email;
      if (tipo !== undefined) data.tipo = tipo;
      if (senha !== undefined && senha !== '') data.senha_hash = await hashSenha(senha);
    }
    const atualizado = await prisma.utilizador.update({ where: { id: targetId }, data });
    res.json(toUserGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// DELETE /user/:id — soft delete (A)
router.delete('/:id', rbac('admin'), async (req, res, next) => {
  try {
    const u = await prisma.utilizador.findUnique({ where: { id: Number(req.params.id) } });
    if (!u) return res.status(404).json({ message: 'Utilizador não encontrado' });
    await prisma.utilizador.update({ where: { id: u.id }, data: { activo: false } });
    res.json({ message: 'Utilizador removido' });
  } catch (err) {
    next(err);
  }
});

export default router;