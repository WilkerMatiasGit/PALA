import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { obterFluxo, FLUXO_DEFAULT } from '../utils/fluxo.js';

// Configuração do sistema — apenas Admin por enquanto.

const router = Router();
router.use(authRequired, rbac('admin'));

const CARGOS_VALIDOS = [
  'admin', 'professor', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento',
];

function validarCargos(cargos) {
  return Array.isArray(cargos)
    && cargos.length > 0
    && cargos.every((c) => CARGOS_VALIDOS.includes(c));
}

// GET /configuracao/fluxo — passos do fluxo com cargos e ordem
router.get('/fluxo', async (req, res, next) => {
  try {
    res.json(await obterFluxo());
  } catch (err) {
    next(err);
  }
});

// PUT /configuracao/fluxo — substituir o fluxo.
// Body: { itens: [{ nome, ordem, cargos }] }  — as etapas não listadas são desativadas.
router.put('/fluxo', async (req, res, next) => {
  try {
    const { itens } = req.body || {};
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ message: 'itens é obrigatório (lista de etapas)' });
    }
    for (const item of itens) {
      if (!item.nome || typeof item.nome !== 'string') {
        return res.status(400).json({ message: 'Cada etapa precisa de um nome' });
      }
      if (!Number.isInteger(item.ordem) || item.ordem < 1) {
        return res.status(400).json({ message: `ordem inválida na etapa ${item.nome}` });
      }
      if (!validarCargos(item.cargos)) {
        return res.status(400).json({ message: `cargos inválidos na etapa ${item.nome}` });
      }
    }

    const nomes = itens.map((i) => i.nome);
    const fluxo = await prisma.$transaction(async (tx) => {
      // Desativa etapas que deixaram de existir
      await tx.fluxoAprovacao.updateMany({
        where: { activo: true, nome: { notIn: nomes } },
        data: { activo: false },
      });
      // Upsert das etapas (por nome único)
      await Promise.all(
        itens.map((i) =>
          tx.fluxoAprovacao.upsert({
            where: { nome: i.nome },
            create: { nome: i.nome, ordem: i.ordem, cargos: i.cargos },
            update: { ordem: i.ordem, cargos: i.cargos, activo: true },
          })
        )
      );
      return obterFluxo();
    });
    res.json(fluxo);
  } catch (err) {
    next(err);
  }
});

// POST /configuracao/fluxo/reset — repor o padrão DLab→Supervisor
router.post('/fluxo/reset', async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fluxoAprovacao.updateMany({ data: { activo: false } });
      await Promise.all(
        FLUXO_DEFAULT.map((f) =>
          tx.fluxoAprovacao.upsert({
            where: { nome: f.nome },
            create: { nome: f.nome, ordem: f.ordem, cargos: f.cargos },
            update: { ordem: f.ordem, cargos: f.cargos, activo: true },
          })
        )
      );
    });
    res.json(await obterFluxo());
  } catch (err) {
    next(err);
  }
});

export default router;