import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { prisma } from '../db.js';

// Verifica o JWT e coloca req.user com { id, nome, email, tipo }.
export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.utilizador.findFirst({
      where: { id: payload.sub, activo: true },
    });
    if (!user) return res.status(401).json({ message: 'Utilizador inválido' });
    req.user = { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
    next();
  } catch {
    return res.status(401).json({ message: 'Sessão expirada ou inválida' });
  }
}

// RBAC: permite apenas os tipos na lista. Ex: rbac('admin').
export function rbac(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Não autenticado' });
    if (!roles.includes(req.user.tipo)) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    next();
  };
}