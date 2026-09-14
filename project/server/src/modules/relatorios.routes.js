import { Router } from 'express';
import { prisma } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { toRelatorioGet } from '../utils/dto.js';

const router = Router();
router.use(authRequired);

async function buildDados(labId, mes, ano) {
  const start = new Date(ano, mes - 1, 1);
  const end = new Date(ano, mes, 1);

  // RF19: COUNT de agendamentos reais (realizados) no mês e as atividades distintas às quais pertencem.
  const realizados = await prisma.agendamento.findMany({
    where: {
      activo: true,
      realizado: true,
      hora_inicio: { gte: start, lt: end },
      actividade: { laboratorio_id: labId, activo: true },
    },
    select: { id: true, actividade: { select: { id: true, tipo: true } } },
  });

  const actIds = [...new Set(realizados.map((g) => g.actividade?.id ?? g.actividade_id))];
  const contagemPorTipo = {};
  for (const g of realizados) {
    const tipo = g.actividade?.tipo;
    contagemPorTipo[tipo] = (contagemPorTipo[tipo] ?? 0) + 1;
  }

  let baixas = 0;
  if (actIds.length > 0) {
    const agg = await prisma.historicoMaterial.aggregate({
      _sum: { quantidade_movimentada: true },
      where: { activo: true, motivo: 'consumo_actividade', actividade_id: { in: actIds } },
    });
    baixas = Math.abs(agg._sum.quantidade_movimentada ?? 0);
  }

  const porTipo = ['aula', 'visita', 'projecto', 'estagio'].map((tipo) => ({
    tipo,
    count: contagemPorTipo[tipo] ?? 0,
  }));

  return {
    total_actividades: actIds.length,
    total_realizadas: realizados.length,
    total_materiais_baixados: baixas,
    por_tipo: porTipo,
    por_lab: [{ lab: '', count: actIds.length }],
  };
}

// GET /relatorios — listar [A,T,C,S,CD]
router.get('/', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const rows = await prisma.relatorio.findMany({
      where: { activo: true },
      include: { laboratorio: true, criadoPor: true },
      orderBy: { id: 'asc' },
    });
    res.json(rows.map(toRelatorioGet));
  } catch (err) {
    next(err);
  }
});

// GET /relatorios/:id/pdf — exportar [A,T,C,S,CD]
router.get('/:id/pdf', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const r = await prisma.relatorio.findFirst({ where: { id: Number(req.params.id), activo: true } });
    if (!r) return res.status(404).json({ message: 'Relatório não encontrado' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${r.mes}-${r.ano}.pdf"`);
    res.send(buildMinimalPdf(`Relatório DLab ${r.mes}/${r.ano}`, r.dados_json));
  } catch (err) {
    next(err);
  }
});

// GET /relatorios/:id
router.get('/:id', rbac('admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'), async (req, res, next) => {
  try {
    const r = await prisma.relatorio.findFirst({
      where: { id: Number(req.params.id), activo: true },
      include: { laboratorio: true, criadoPor: true },
    });
    if (!r) return res.status(404).json({ message: 'Relatório não encontrado' });
    res.json(toRelatorioGet(r));
  } catch (err) {
    next(err);
  }
});

// POST /relatorios — gerar [A,T] (RF19)
router.post('/', rbac('admin', 'tecnico'), async (req, res, next) => {
  try {
    const { laboratorio_id, mes, ano } = req.body || {};
    if (!laboratorio_id || !mes || !ano) {
      return res.status(400).json({ message: 'laboratorio_id, mes e ano são obrigatórios' });
    }
    const lab = await prisma.laboratorio.findFirst({ where: { id: Number(laboratorio_id), activo: true } });
    if (!lab) return res.status(404).json({ message: 'Laboratório não encontrado' });

    const dados = await buildDados(Number(laboratorio_id), Number(mes), Number(ano));
    dados.por_lab = [{ lab: lab.nome, count: dados.total_actividades }];

    const novo = await prisma.relatorio.create({
      data: {
        laboratorio_id: Number(laboratorio_id),
        criado_por: req.user.id,
        mes: Number(mes),
        ano: Number(ano),
        dados_json: JSON.stringify(dados),
      },
      include: { laboratorio: true, criadoPor: true },
    });
    res.status(201).json(toRelatorioGet(novo));
  } catch (err) {
    next(err);
  }
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