import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { stockActual } from '../utils/stock.js';

const router = Router();
router.use(authRequired);

// GET /agendamentos — listar (filtros laboratorio_id, mes, ano). Só aprovado_supervisor (RF12).
router.get('/', (req, res) => {
  const db = getDb();
  let result = db.agendamentos.filter((g) => {
    const act = db.actividades.find((a) => a.id === g.actividade_id && a.activo !== false);
    return act && act.estado === 'aprovado_supervisor' && g.activo !== false;
  });
  if (req.query.laboratorio_id) result = result.filter((g) => g.laboratorio_id === Number(req.query.laboratorio_id));
  if (req.query.mes && req.query.ano) {
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);
    result = result.filter((g) => {
      const d = new Date(g.hora_inicio);
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });
  }
  res.json(result);
});

// PUT /agendamentos/:id/confirmar-professor — professor marca concluído (A,P)
router.put('/:id/confirmar-professor', rbac('admin', 'professor'), (req, res) => {
  const db = getDb();
  const ag = db.agendamentos.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!ag) return res.status(404).json({ message: 'Agendamento não encontrado' });
  const act = db.actividades.find((a) => a.id === ag.actividade_id);
  if (!act || act.estado !== 'aprovado_supervisor') {
    return res.status(409).json({ message: 'A atividade ainda não foi aprovada pelo Supervisor; só pode ser concluída após a aprovação final.' });
  }
  ag.confirmado_professor_em = new Date().toISOString();
  ag.actualizado_em = new Date().toISOString();
  persist();
  res.json(ag);
});

// PUT /agendamentos/:id/confirmar-tecnico — técnico confirma; quando ambos, realizada → baixa stock (T,A)
router.put('/:id/confirmar-tecnico', rbac('tecnico', 'admin'), (req, res) => {
  const db = getDb();
  const ag = db.agendamentos.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!ag) return res.status(404).json({ message: 'Agendamento não encontrado' });
  const act = db.actividades.find((a) => a.id === ag.actividade_id);
  if (!act || act.estado !== 'aprovado_supervisor') {
    return res.status(409).json({ message: 'A atividade ainda não foi aprovada pelo Supervisor; só pode ser concluída após a aprovação final.' });
  }
  ag.confirmado_tecnico_em = new Date().toISOString();
  if (ag.confirmado_professor_em) {
    const foiRealizada = ag.realizado;
    ag.realizado = true;
    // Passo 5: baixa automática de stock (uma única vez, quando passa a realizada)
    if (!foiRealizada) {
      const pedidos = db.actividadeMateriais.filter(
        (m) => m.actividade_id === ag.actividade_id && m.activo !== false
      );
      const now = new Date().toISOString();
      for (const ped of pedidos) {
        const qtd = -Number(ped.quantidade_estimada || 0);
        if (qtd === 0) continue;
        db.historico.push({
          id: genId(),
          material_id: ped.material_id,
          material_nome: ped.material_nome,
          utilizador_id: req.user.id,
          utilizador_nome: req.user.nome,
          actividade_id: ag.actividade_id,
          quantidade_movimentada: qtd,
          motivo: 'consumo_actividade',
          descricao: 'Consumo automático após confirmação de presença',
          activo: true,
          criado_em: now,
          actualizado_em: now,
        });
        const mat = db.materiais.find((m) => m.id === ped.material_id);
        if (mat) {
          mat.quantidade = stockActual(mat.id);
          mat.actualizado_em = now;
        }
      }
    }
  }
  ag.actualizado_em = new Date().toISOString();
  persist();
  res.json(ag);
});

// POST /agendamentos — criar (valida choque RF13)
router.post('/', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const { actividade_id, hora_inicio, hora_fim } = req.body || {};
  if (!actividade_id || !hora_inicio || !hora_fim) {
    return res.status(400).json({ message: 'actividade_id, hora_inicio e hora_fim são obrigatórios' });
  }
  const db = getDb();
  const act = db.actividades.find((a) => a.id === Number(actividade_id) && a.activo !== false);
  if (!act) return res.status(404).json({ message: 'Atividade não encontrada' });

  // RF13: bloquear choque com agendamentos de atividades aprovado_supervisor no mesmo lab
  const start = new Date(hora_inicio).getTime();
  const end = new Date(hora_fim).getTime();
  if (start >= end) return res.status(400).json({ message: 'hora_fim deve ser posterior a hora_inicio' });
  const choque = db.agendamentos.some((g) => {
    if (g.activo === false) return false;
    const ga = db.actividades.find((a) => a.id === g.actividade_id);
    if (!ga || ga.estado !== 'aprovado_supervisor') return false;
    if (ga.laboratorio_id !== act.laboratorio_id) return false;
    const gs = new Date(g.hora_inicio).getTime();
    const ge = new Date(g.hora_fim).getTime();
    return start < ge && gs < end;
  });
  if (choque) {
    return res.status(409).json({ message: 'Choque de horário: já existe um agendamento aprovado neste laboratório no intervalo indicado.' });
  }

  const now = new Date().toISOString();
  const novo = {
    id: genId(),
    actividade_id: Number(actividade_id),
    actividade_nome: act.nome,
    laboratorio_id: act.laboratorio_id,
    laboratorio_nome: act.laboratorio_nome,
    hora_inicio,
    hora_fim,
    confirmado_professor_em: null,
    confirmado_tecnico_em: null,
    realizado: false,
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.agendamentos.push(novo);
  persist();
  res.status(201).json(novo);
});

// PUT /agendamentos/:id — atualizar horário
router.put('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const ag = db.agendamentos.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!ag) return res.status(404).json({ message: 'Agendamento não encontrado' });
  const { hora_inicio, hora_fim } = req.body || {};
  if (hora_inicio !== undefined) ag.hora_inicio = hora_inicio;
  if (hora_fim !== undefined) ag.hora_fim = hora_fim;
  ag.actualizado_em = new Date().toISOString();
  persist();
  res.json(ag);
});

// DELETE /agendamentos/:id — soft
router.delete('/:id', rbac('admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const ag = db.agendamentos.find((x) => x.id === Number(req.params.id));
  if (!ag) return res.status(404).json({ message: 'Agendamento não encontrado' });
  ag.activo = false;
  persist();
  res.json({ message: 'Agendamento removido' });
});

export default router;
