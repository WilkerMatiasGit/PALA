import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

// Fila principal /aprovacoes
const fila = Router();
fila.use(authRequired, rbac('admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'));

function toFilaRow(act) {
  const db = getDb();
  const etapa = act.estado === 'aprovado_dlab' ? 'supervisor' : 'dlab';
  return {
    id: act.id, // = actividade_id (para navegação /aprovacoes/{id})
    actividade_id: act.id,
    actividade_nome: act.nome,
    aprovador_id: 0,
    aprovador_nome: '',
    etapa,
    decisao: 'aprovado',
    comentario: '',
    decidido_em: '',
    criado_em: act.criado_em,
    actualizado_em: act.actualizado_em,
  };
}

// GET /aprovacoes — fila adaptativa (RF09/RF10)
fila.get('/', (req, res) => {
  const db = getDb();
  const target = req.user.tipo === 'supervisor' ? 'aprovado_dlab' : 'pendente';
  const rows = db.actividades
    .filter((a) => a.activo !== false && a.estado === target)
    .map(toFilaRow);
  res.json(rows);
});

// GET /aprovacoes/:id — :id é o actividade_id (fila keyed por atividade)
fila.get('/:id', (req, res) => {
  const db = getDb();
  const act = db.actividades.find((a) => a.id === Number(req.params.id) && a.activo !== false);
  if (!act) return res.status(404).json({ message: 'Atividade não encontrada' });
  res.json(toFilaRow(act));
});

// POST /aprovacoes — emitir voto (RF09/RF10/RF11). Body: {actividade_id, etapa, decisao, comentario?}
fila.post('/', (req, res) => {
  const { actividade_id, etapa, decisao, comentario } = req.body || {};
  if (!actividade_id || !etapa || !decisao) {
    return res.status(400).json({ message: 'actividade_id, etapa e decisao são obrigatórios' });
  }
  if (!['dlab', 'supervisor'].includes(etapa)) return res.status(400).json({ message: 'etapa inválida' });
  if (!['aprovado', 'rejeitado'].includes(decisao)) return res.status(400).json({ message: 'decisao inválida' });
  if (!comentario || !comentario.trim()) {
    return res.status(400).json({ message: 'Comentário/Parecer é obrigatório' });
  }

  const db = getDb();
  const act = db.actividades.find((a) => a.id === Number(actividade_id) && a.activo !== false);
  if (!act) return res.status(404).json({ message: 'Atividade não encontrada' });

  // RBAC por etapa: dlab só coordenador_dlab/admin; supervisor só supervisor/admin
  if (etapa === 'dlab' && !['coordenador_dlab', 'admin'].includes(req.user.tipo)) {
    return res.status(403).json({ message: 'Só o Coordenador DLab pode votar nesta etapa' });
  }
  if (etapa === 'supervisor' && !['supervisor', 'admin'].includes(req.user.tipo)) {
    return res.status(403).json({ message: 'Só o Supervisor ou o Admin podem votar nesta etapa' });
  }

  // Validações de estado para evitar votos fora de ordem
  if (decisao === 'rejeitado') {
    // pode rejeitar do estado atual da fila correspondente
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

  const now = new Date().toISOString();
  // Atualiza estado da atividade
  if (decisao === 'rejeitado') {
    act.estado = 'rejeitado';
  } else if (etapa === 'supervisor') {
    act.estado = 'aprovado_supervisor';
  } else {
    act.estado = 'aprovado_dlab';
  }
  act.actualizado_em = now;

  const nova = {
    id: genId(),
    actividade_id: Number(actividade_id),
    aprovador_id: req.user.id,
    aprovador_nome: req.user.nome,
    etapa,
    decisao,
    comentario,
    decidido_em: now,
    criado_em: now,
    actualizado_em: now,
    activo: true,
  };
  db.aprovacoes.push(nova);
  persist();
  res.status(201).json(nova);
});

export default fila;

// GET /actividades/:id/aprovacoes — histórico de aprovações da atividade
export const historico = (() => {
  const r = Router();
  r.use(authRequired);
  r.get('/:id/aprovacoes', (req, res) => {
    const db = getDb();
    res.json(db.aprovacoes.filter((a) => a.actividade_id === Number(req.params.id) && a.activo !== false));
  });
  return r;
})();
