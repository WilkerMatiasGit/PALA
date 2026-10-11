import { Router } from 'express';
import { prisma, TIPOS_ACTIVIDADE } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { obterFluxo, FLUXO_DEFAULT } from '../utils/fluxo.js';
import { toLimiteGet } from '../utils/dto.js';

// Configuração do sistema.
//  - Fluxo de aprovação: só Admin (a leitura do fluxo é feita internamente pelo motor).
//  - Limites de participantes: GET para qualquer utilizador autenticado (o professor
//    precisa de ler para validar o formulário); PUT só Admin.

const router = Router();
router.use(authRequired);

const CARGOS_VALIDOS = [
  'admin', 'professor', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento',
];

function validarCargos(cargos) {
  return Array.isArray(cargos)
    && cargos.length > 0
    && cargos.every((c) => CARGOS_VALIDOS.includes(c));
}

// GET /configuracao/fluxo — passos do fluxo com cargos e ordem
router.get('/fluxo', rbac('admin'), async (req, res, next) => {
  try {
    res.json(await obterFluxo());
  } catch (err) {
    next(err);
  }
});

// PUT /configuracao/fluxo — substituir o fluxo.
// Body: { itens: [{ nome, ordem, cargos }] }  — as etapas não listadas são desativadas.
router.put('/fluxo', rbac('admin'), async (req, res, next) => {
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
router.post('/fluxo/reset', rbac('admin'), async (req, res, next) => {
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

// GET /configuracao/limites — limites de participantes por tipo (qualquer autenticado)
router.get('/limites', async (req, res, next) => {
  try {
    const rows = await prisma.limiteParticipantes.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    res.json(rows.map(toLimiteGet));
  } catch (err) {
    next(err);
  }
});

// PUT /configuracao/limites — substituir os 4 tipos (só Admin).
// Body: { itens: [{ tipo, min, max, limite_activo }] }.
// Valida sempre min >= 1 e min <= max, mesmo quando o tipo está inativo.
router.put('/limites', rbac('admin'), async (req, res, next) => {
  try {
    const { itens } = req.body || {};
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ message: 'itens é obrigatório (lista com os 4 tipos)' });
    }
    const vistos = new Set();
    for (const it of itens) {
      if (!it || typeof it.tipo !== 'string' || !TIPOS_ACTIVIDADE.includes(it.tipo)) {
        return res.status(400).json({ message: `tipo inválido: ${it?.tipo}` });
      }
      if (vistos.has(it.tipo)) {
        return res.status(400).json({ message: `tipo duplicado: ${it.tipo}` });
      }
      vistos.add(it.tipo);
      const min = Number(it.min);
      const max = Number(it.max);
      if (!Number.isInteger(min) || min < 1) {
        return res.status(400).json({ message: `O mínimo de ${it.tipo} deve ser um inteiro maior ou igual a 1` });
      }
      if (!Number.isInteger(max) || max < 1) {
        return res.status(400).json({ message: `O máximo de ${it.tipo} deve ser um inteiro maior ou igual a 1` });
      }
      if (min > max) {
        return res.status(400).json({ message: `O mínimo de ${it.tipo} (${min}) não pode ser superior ao máximo (${max})` });
      }
    }
    if (TIPOS_ACTIVIDADE.some((t) => !vistos.has(t))) {
      return res.status(400).json({ message: 'É obrigatório enviar os 4 tipos: aula, visita, projecto, estagio' });
    }

    await prisma.$transaction(async (tx) => {
      for (const it of itens) {
        await tx.limiteParticipantes.upsert({
          where: { tipo: it.tipo },
          create: { tipo: it.tipo, min: Number(it.min), max: Number(it.max), limite_activo: Boolean(it.limite_activo) },
          update: { min: Number(it.min), max: Number(it.max), limite_activo: Boolean(it.limite_activo), activo: true },
        });
      }
    });
    const rows = await prisma.limiteParticipantes.findMany({ where: { activo: true }, orderBy: { id: 'asc' } });
    res.json(rows.map(toLimiteGet));
  } catch (err) {
    next(err);
  }
});

export default router;