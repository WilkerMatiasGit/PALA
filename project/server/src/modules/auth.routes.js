import { Router } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import { prisma } from '../db.js';
import { verifySenha } from '../utils/hash.js';

const router = Router();

// POST /user/login — LoginRequest { email, senha } → LoginResponse { user, token }
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }
    const user = await prisma.utilizador.findFirst({
      where: { email, activo: true },
    });
    // Utilizadores de seed podem não ter hash (atribuído com a password predefinida no init).
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });

    if (user.senha_hash) {
      const ok = await verifySenha(user.senha_hash, senha);
      if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });
    } else {
      const DEFAULT = '12345678';
      if (senha !== DEFAULT) return res.status(401).json({ message: 'Credenciais inválidas' });
      // Guarda o hash a partir de agora.
      const senhaHash = await argon2.hash(DEFAULT);
      await prisma.utilizador.update({
        where: { id: user.id },
        data: { senha_hash: senhaHash },
      });
    }

    const authUser = { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
    const token = jwt.sign(
      { sub: user.id, tipo: user.tipo, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ user: authUser, token });
  } catch (err) {
    next(err);
  }
});

export default router;