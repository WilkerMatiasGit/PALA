import { Router } from 'express';
import { getDb, genId, persist } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function buildDados(labId, mes, ano) {
  const db = getDb();
  const acts = db.actividades.filter(
    (a) => a.laboratorio_id === labId && a.activo !== false && a.estado === 'aprovado_supervisor'
  );
  const actsNoMes = acts.filter((a) => {
    const d = new Date(a.criado_em);
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });
  const realizados = db.agendamentos.filter((g) => {
    if (g.activo === false || !g.realizado) return false;
    const act = db.actividades.find((x) => x.id === g.actividade_id);
    if (!act || act.laboratorio_id !== labId) return false;
    const d = new Date(g.hora_inicio);
    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
  });

  const contagem = (tipo) => actsNoMes.filter((a) => a.tipo === tipo).length;
  // Baixa de materiais: soma das movimentações de consumo das atividades aprovadas do lab no mês
  const ids = new Set(actsNoMes.map((a) => a.id));
  const baixas = db.historico
    .filter((h) => h.motivo === 'consumo_actividade' && h.actividade_id && ids.has(h.actividade_id))
    .reduce((sum, h) => sum + Math.abs(Number(h.quantidade_movimentada || 0)), 0);

  return {
    total_actividades: actsNoMes.length,
    total_realizadas: realizados.length,
    total_materiais_baixados: baixas,
    por_tipo: [
      { tipo: 'aula', count: contagem('aula') },
      { tipo: 'visita', count: contagem('visita') },
      { tipo: 'projecto', count: contagem('projecto') },
      { tipo: 'estagio', count: contagem('estagio') },
    ],
    por_lab: [{ lab: '', count: actsNoMes.length }],
  };
}

// GET /relatorios — listar [A,T,C,S,CD]
router.get('/', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  res.json(db.relatorios.filter((r) => r.activo !== false));
});

// GET /relatorios/:id/pdf — exportar [A,T,C,S,CD]
router.get('/:id/pdf', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const r = db.relatorios.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!r) return res.status(404).json({ message: 'Relatório não encontrado' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${r.mes}-${r.ano}.pdf"`);
  res.send(buildMinimalPdf(`Relatório DLab ${r.mes}/${r.ano}`, r.dados_json));
});

// GET /relatorios/:id
router.get('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), (req, res) => {
  const db = getDb();
  const r = db.relatorios.find((x) => x.id === Number(req.params.id) && x.activo !== false);
  if (!r) return res.status(404).json({ message: 'Relatório não encontrado' });
  res.json(r);
});

// POST /relatorios — gerar [A,T] (Rf19)
router.post('/', rbac('admin', 'tecnico'), (req, res) => {
  const { laboratorio_id, mes, ano } = req.body || {};
  if (!laboratorio_id || !mes || !ano) {
    return res.status(400).json({ message: 'laboratorio_id, mes e ano são obrigatórios' });
  }
  const db = getDb();
  const lab = db.laboratorios.find((l) => l.id === Number(laboratorio_id));
  if (!lab) return res.status(404).json({ message: 'Laboratório não encontrado' });
  const now = new Date().toISOString();
  const dados = buildDados(Number(laboratorio_id), Number(mes), Number(ano));
  dados.por_lab = [{ lab: lab.nome, count: dados.total_actividades }];
  const novo = {
    id: genId(),
    laboratorio_id: Number(laboratorio_id),
    laboratorio_nome: lab.nome,
    criado_por: req.user.id,
    criado_por_nome: req.user.nome,
    mes: Number(mes),
    ano: Number(ano),
    dados_json: JSON.stringify(dados),
    activo: true,
    criado_em: now,
    actualizado_em: now,
  };
  db.relatorios.push(novo);
  persist();
  res.status(201).json(novo);
});

// Gera um PDF mínimo válido (sem dependências externas) — suficiente para exportação simples.
function buildMinimalPdf(title, dadosJson) {
  let dadosTxt = dadosJson;
  try { dadosTxt = JSON.stringify(JSON.parse(dadosJson), null, 1); } catch {}
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 12 Tf 50 760 Td (${esc(title)}) Tj ET\n` +
    `BT /F1 8 Tf 50 730 Td (${esc(dadosTxt.slice(0, 3000))}) Tj ET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >> stream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

export default router;
