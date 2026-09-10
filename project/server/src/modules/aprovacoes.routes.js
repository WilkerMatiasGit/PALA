import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toAprovacaoGet } from '../utils/dto.js';

// Fila principal /aprovacoes
const fila = Router();
fila.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'));

// Linha sintética da fila — o id é o da atividade para navegação /aprovacoes/{id}
function toFilaRow(act) {
  const etapa = act.estado === 'aprovado_dlab' ? 'supervisor' : 'dlab';
  return {
    id: act.id,
    actividade_id: act.id,
    actividade_nome: act.nome,
    aprovador_id: 0,
    aprovador_nome: '',
    etapa,
    decisao: act.estado === 'aprovado_dlab' ? 'aprovado' : '',
    comentario: '',
    decidido_em: '',
    criado_em: act.criado_em,
    actualizado_em: act.actualizado_em,
  };
}

// GET /aprovacoes — fila adaptativa (RF09/RF10)
fila.get('/', async (req, res, next) => {
  try {
    const target = req.user.tipo === 'supervisor' ? 'aprovado_dlab' : 'pendente';
    const acts = await prisma.actividade.findMany({
      where: { activo: true, estado: target },
      orderBy: { id: 'asc' },
    });
    res.json(acts.map(toFilaRow));
  } catch (err) {
    next(err);
  }
});

// GET /aprovacoes/:id — :id é o actividade_id (fila keyed por atividade)
fila.get('/:id', async (req, res, next) => {
  try {
    const act = await prisma.actividade.findFirst({ where: { id: Number(req.params.id), activo: true } });
    if (!act) return res.status(404).json({ message: 'Atividade não encontrada' });
    res.json(toFilaRow(act));
  } catch (err) {
    next(err);
  }
});

// POST /aprovacoes — emitir voto (RF09/RF10/RF11). Body: {actividade_id, etapa, decisao, comentario?}
fila.post('/', async (req, res, next) => {
  try {
    const { actividade_id, etapa, decisao, comentario } = req.body || {};
    if (!actividade_id || !etapa || !decisao) {
      return res.status(400).json({ message: 'actividade_id, etapa e decisao são obrigatórios' });
    }
    if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });
    if (!['aprovado', 'rejeitado'].includes(decisao)) return res.status(400).json({ message: 'decisao inválida' });
    if (!comentario || !comentario.trim()) {
      return res.status(400).json({ message: 'Comentário/Parecer é obrigatório' });
    }

    const act = await prisma.actividade.findUnique({ where: { id: Number(actividade_id) } });
    if (!act || !act.activo) return res.status(404).json({ message: 'Atividade não encontrada' });

    // RBAC por etapa: dlab só coordenador_dlab/admin; supervisor só supervisor/admin
    if (etapa === 'dlab' && !['coordenador_dlab', 'admin'].includes(req.user.tipo)) {
      return res.status(403).json({ message: 'Só o Coordenador DLab pode votar nesta etapa' });
    }
    if (etapa === 'supervisor' && !['supervisor', 'admin'].includes(req.user.tipo)) {
      return res.status(403).json({ message: 'Só o Supervisor ou o Admin podem votar nesta etapa' });
    }

    // Validações de estado para evitar votos fora de ordem
    if (decisao === 'rejeitado') {
      const expected = etapa === 'supervisor' ? 'aprovado_dlab' : 'pendente';
      if (act.estado !== expected) return res.status(409).json({ message: 'Estado não permite este voto' });
    } else {
      if (etapa === 'dlab' && act.estado !== 'pendente') {
        return res.status(409).json({ message: 'A atividade já não está pendente' });
      }
      if (etapa === 'supervisor' && act.estado !== 'aprovado_dlab') {
        return res.status(409).json({ message: 'A atividade ainda não foi aprovada pelo DLab' });
      }
    }

    // Atualiza estado da atividade
    let novoEstado = act.estado;
    if (decisao === 'rejeitado') novoEstado = 'rejeitado';
    else if (etapa === 'supervisor') novoEstado = 'aprovado_supervisor';
    else novoEstado = 'aprovado_dlab';

    const nova = await prisma.$transaction(async (tx) => {
      await tx.actividade.update({ where: { id: act.id }, data: { estado: novoEstado } });
      return tx.aprovacao.create({
        data: {
          actividade_id: Number(actividade_id),
          aprovador_id: req.user.id,
          etapa,
          decisao,
          comentario,
          decidido_em: new Date(),
        },
        include: {
          aprovador: true,
          actividade: { select: { nome: true } },
        },
      });
    });
    res.status(201).json(toAprovacaoGet(nova));
  } catch (err) {
    next(err);
  }
});

export default fila;

// GET /actividades/:id/aprovacoes — histórico de aprovações da atividade
export const historico = (() => {
  const r = Router();
  r.use(authRequired);
  r.get('/:id/aprovacoes', async (req, res, next) => {
    try {
      const rows = await prisma.aprovacao.findMany({
        where: { actividade_id: Number(req.params.id), activo: true },
        include: { aprovador: true, actividade: { select: { nome: true } } },
        orderBy: { id: 'asc' },
      });
      res.json(rows.map(toAprovacaoGet));
    } catch (err) {
      next(err);
    }
  });
  return r;
})();