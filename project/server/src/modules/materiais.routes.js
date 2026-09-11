import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { stockActual, recomputeMaterial } from '../utils/stock.js';
import { toMaterialGet, toHistoricoGet } from '../utils/dto.js';

const router = Router();
router.use(authRequired);

const materialInclude = { laboratorio: true };
const historicoInclude = { material: true, utilizador: true, actividade: true };

// GET /materiais — listar (filtros laboratorio_id, categoria, estado)
router.get('/', async (req, res, next) => {
  try {
    const where = { activo: true };
    if (req.query.laboratorio_id) where.laboratorio_id = Number(req.query.laboratorio_id);
    if (req.query.categoria) where.categoria = req.query.categoria;
    if (req.query.estado) where.estado = req.query.estado;
    const rows = await prisma.material.findMany({ where, include: materialInclude, orderBy: { id: 'asc' } });
    res.json(rows.map(toMaterialGet));
  } catch (err) {
    next(err);
  }
});

// GET /materiais/historico — movimentações (definir antes de /:id)
router.get('/historico', async (req, res, next) => {
  try {
    const where = { activo: true };
    if (req.query.material_id) where.material_id = Number(req.query.material_id);
    if (req.query.motivo) where.motivo = req.query.motivo;
    const rows = await prisma.historicoMaterial.findMany({ where, include: historicoInclude, orderBy: { id: 'asc' } });
    res.json(rows.map(toHistoricoGet));
  } catch (err) {
    next(err);
  }
});

// POST /materiais/historico — registar movimentação (RF16/RF17)  [A,T,S,CD]
router.post('/historico', rbac('admin', 'tecnico', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const { material_id, utilizador_id, actividade_id, quantidade_movimentada, motivo, descricao } = req.body || {};
    if (!material_id || quantidade_movimentada == null || !motivo || !descricao) {
      return res.status(400).json({ message: 'material_id, quantidade_movimentada, motivo e descricao são obrigatórios' });
    }
    const mat = await prisma.material.findUnique({ where: { id: Number(material_id) } });
    if (!mat) return res.status(404).json({ message: 'Material não encontrado' });

    const nova = await prisma.historicoMaterial.create({
      data: {
        material_id: Number(material_id),
        utilizador_id: Number(utilizador_id),
        ...(actividade_id ? { actividade_id: Number(actividade_id) } : {}),
        quantidade_movimentada: Number(quantidade_movimentada),
        motivo,
        descricao,
      },
      include: historicoInclude,
    });
    await recomputeMaterial(mat.id); // RF17
    res.status(201).json(toHistoricoGet(nova));
  } catch (err) {
    next(err);
  }
});

// GET /materiais/:id/historico — movimentações de um material
router.get('/:id/historico', async (req, res, next) => {
  try {
    const rows = await prisma.historicoMaterial.findMany({
      where: { material_id: Number(req.params.id), activo: true },
      include: historicoInclude,
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toHistoricoGet));
  } catch (err) {
    next(err);
  }
});

// GET /materiais/:id
router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.material.findFirst({ where: { id: Number(req.params.id), activo: true }, include: materialInclude });
    if (!m) return res.status(404).json({ message: 'Material não encontrado' });
    // RF17: devolve quantidade calculada do histórico (fonte da verdade)
    const dto = toMaterialGet(m);
    dto.quantidade = await stockActual(m.id);
    res.json(dto);
  } catch (err) {
    next(err);
  }
});

// POST /materiais — criar material (+ 1ª movimentação de stock inicial)  [A,T,C,S,CD]
router.post('/', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const { laboratorio_id, nome, categoria, quantidade_minima, unidade, estado, quantidade_inicial } = req.body || {};
    if (!laboratorio_id || !nome || !categoria || quantidade_minima == null || !unidade) {
      return res.status(400).json({ message: 'laboratorio_id, nome, categoria, quantidade_minima e unidade são obrigatórios' });
    }
    const lab = await prisma.laboratorio.findUnique({ where: { id: Number(laboratorio_id) } });
    if (!lab) return res.status(404).json({ message: 'Laboratório não encontrado' });
    const dup = await prisma.material.findFirst({
      where: { activo: true, laboratorio_id: Number(laboratorio_id), nome: String(nome).trim() },
    });
    if (dup) return res.status(409).json({ message: 'Já existe um material com este nome neste laboratório' });

    const inicial = Number(quantidade_inicial || 0);
    const novo = await prisma.material.create({
      data: {
        laboratorio_id: Number(laboratorio_id),
        nome,
        categoria,
        quantidade: 0,
        quantidade_minima: Number(quantidade_minima),
        unidade,
        estado: estado || 'disponivel',
      },
      include: materialInclude,
    });
    // RF17: stock inicial nasce do histórico (1ª movimentação)
    if (inicial !== 0) {
      await prisma.historicoMaterial.create({
        data: {
          material_id: novo.id,
          utilizador_id: req.user.id,
          quantidade_movimentada: inicial,
          motivo: 'compra_stock',
          descricao: 'Stock inicial de registo',
        },
      });
      await recomputeMaterial(novo.id);
    }
    res.status(201).json(toMaterialGet(novo));
  } catch (err) {
    next(err);
  }
});

// PUT /materiais/:id — atualizar (SEM quantidade — RF17)  [A,T,C,S,CD]
router.put('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
    if (!m) return res.status(404).json({ message: 'Material não encontrado' });
    const { nome, categoria, quantidade_minima, unidade, estado } = req.body || {};
    if (nome !== undefined) {
      const dup = await prisma.material.findFirst({
        where: { activo: true, id: { not: m.id }, laboratorio_id: m.laboratorio_id, nome: String(nome).trim() },
      });
      if (dup) return res.status(409).json({ message: 'Já existe um material com este nome neste laboratório' });
    }
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (categoria !== undefined) data.categoria = categoria;
    if (quantidade_minima !== undefined) data.quantidade_minima = Number(quantidade_minima);
    if (unidade !== undefined) data.unidade = unidade;
    if (estado !== undefined) data.estado = estado;
    const atualizado = await prisma.material.update({ where: { id: m.id }, data, include: materialInclude });
    res.json(toMaterialGet(atualizado));
  } catch (err) {
    next(err);
  }
});

// DELETE /materiais/:id — soft [A,T,C,S,CD]
router.delete('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
    if (!m) return res.status(404).json({ message: 'Material não encontrado' });
    await prisma.material.update({ where: { id: m.id }, data: { activo: false } });
    res.json({ message: 'Material removido' });
  } catch (err) {
    next(err);
  }
});

export default router;