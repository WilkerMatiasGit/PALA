import { Router } from 'express';
import { prisma, TIPOS_ACTIVIDADE, CONFIGURACAO_GERAL_ID } from '../db.js';
import { authRequired, rbac } from '../middleware/auth.js';
import { obterFluxo, FLUXO_DEFAULT } from '../utils/fluxo.js';
import { obterConfiguracaoGeral } from '../utils/configuracao.js';
import { toLimiteGet, toConfiguracaoGeralGet, toFeriadoGet } from '../utils/dto.js';
import { feriadoCobre } from '../utils/validarSessao.js';

// Configuração do sistema.
//  - Fluxo de aprovação: só Admin (a leitura do fluxo é feita internamente pelo motor).
//  - Limites de participantes: GET para qualquer utilizador autenticado (o professor
//    precisa de ler para validar o formulário); PUT só Admin.
//  - Configurações gerais: GET para qualquer autenticado (idem); PUT só Admin.
//  - Feriados: GET para qualquer autenticado; POST/PUT/DELETE só Admin.

const router = Router();
router.use(authRequired);

const TIPOS_FERIADO = ['feriado', 'feriado_movel', 'ponte', 'tolerancia'];

function diaCalendario(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function fmtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function parseISODate(iso) {
  const d = diaCalendario(iso);
  if (!d) throw Object.assign(new Error('data inválida'), { status: 400 });
  const dt = new Date(`${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== d) {
    throw Object.assign(new Error('data inválida'), { status: 400 });
  }
  return dt;
}

async function sessoesAfectadasPorFeriado(dia, tipoNovo) {
  const hoje = diaCalendario(new Date());
  const atividades = await prisma.actividade.findMany({
    where: { activo: true, estado: { not: 'rejeitada' } },
    select: { id: true, nome: true },
  });
  const res = [];
  const vistos = new Set();
  for (const a of atividades) {
    const ags = await prisma.agendamento.findMany({
      where: { actividade_id: a.id, activo: true, estado: { not: 'rejeitado' } },
      select: { id: true, hora_inicio: true },
    });
    for (const ag of ags) {
      const d2 = diaCalendario(ag.hora_inicio);
      if (!d2 || (hoje && d2 < hoje)) continue;
      let cobre = false;
      if (tipoNovo === 'feriado') {
        const [, m, d] = dia.split('-').map(Number);
        const [, fm, fdd] = d2.split('-').map(Number);
        // Um feriado anual (tipo 'feriado') repete-se todos os anos no mesmo dia/mês.
        if (fm === m && fdd === d) cobre = true;
      } else if (d2 === dia) {
        cobre = true;
      }
      if (cobre && !vistos.has(`${a.id}:${ag.id}:${d2}`)) {
        vistos.add(`${a.id}:${ag.id}:${d2}`);
        res.push({ actividade_id: a.id, actividade_nome: a.nome, agendamento_id: ag.id, data: d2 });
      }
    }
  }
  // agrupar por atividade para o formato pedido
  const map = new Map();
  for (const r of res) {
    if (!map.has(r.actividade_id)) map.set(r.actividade_id, { id: r.actividade_id, nome: r.actividade_nome, sessoes: [] });
    map.get(r.actividade_id).sessoes.push({ agendamento_id: r.agendamento_id, data: r.data });
  }
  return Array.from(map.values());
}

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

// GET /configuracao/feriados — qualquer autenticado
router.get('/feriados', async (req, res, next) => {
  try {
    const rows = await prisma.feriado.findMany({ where: { activo: true }, orderBy: { data: 'asc' } });
    res.json(rows.map(toFeriadoGet));
  } catch (err) {
    next(err);
  }
});

// POST /configuracao/feriados — Admin
router.post('/feriados', rbac('admin'), async (req, res, next) => {
  try {
    const { nome, data, tipo } = req.body || {};
    if (!nome || typeof nome !== 'string') {
      return res.status(400).json({ message: 'nome é obrigatório' });
    }
    const nomeTrim = nome.trim();
    if (nomeTrim.length === 0) return res.status(400).json({ message: 'nome é obrigatório' });
    if (nomeTrim.length > 100) return res.status(400).json({ message: 'nome não pode ter mais de 100 caracteres' });
    if (!tipo || !TIPOS_FERIADO.includes(tipo)) {
      return res.status(400).json({ message: 'tipo inválido' });
    }
    const dia = diaCalendario(data);
    if (!dia) return res.status(400).json({ message: 'data inválida' });
    if (tipo === 'feriado') {
      const [, m, d] = dia.split('-').map(Number);
      if (m === 2 && d === 29) {
        return res.status(400).json({ message: 'Não é permitido registar 29/02 como feriado anual.' });
      }
    }
    // verificar unicidade contra feriados efectivos activos (exacto ou feriado anual cobre dia/mês)
    const existentes = await prisma.feriado.findMany({ where: { activo: true } });
    for (const ex of existentes) {
      if (feriadoCobre(ex, dia)) {
        return res.status(409).json({ message: `Já existe um feriado efectivo nesta data: ${ex.nome} (${fmtBR(diaCalendario(ex.data))}, ${ex.tipo}).` });
      }
    }
    // se existe inactivo com mesma data exacta? regra: "If soft-deleted same date existed -> reactivate on POST (200) like catalogs"
    const inactivoMesmaData = await prisma.feriado.findFirst({ where: { data: parseISODate(dia), activo: false } });
    if (inactivoMesmaData) {
      const atualizado = await prisma.feriado.update({
        where: { id: inactivoMesmaData.id },
        data: { nome: nomeTrim, tipo, activo: true, actualizado_em: new Date() },
      });
      const afectadas = await sessoesAfectadasPorFeriado(dia, tipo);
      return res.json({ ...toFeriadoGet(atualizado), sessoes_afectadas_count: afectadas.reduce((acc, a) => acc + (a.sessoes?.length || 0), 0), actividades_afectadas: afectadas });
    }
    const criado = await prisma.feriado.create({
      data: { nome: nomeTrim, data: parseISODate(dia), tipo },
    });
    const afectadas = await sessoesAfectadasPorFeriado(dia, tipo);
    res.status(200).json({ ...toFeriadoGet(criado), sessoes_afectadas_count: afectadas.reduce((acc, a) => acc + (a.sessoes?.length || 0), 0), actividades_afectadas: afectadas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Já existe um feriado nesta data.' });
    }
    next(err);
  }
});

// PUT /configuracao/feriados/:id — Admin
router.put('/feriados/:id', rbac('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existente = await prisma.feriado.findUnique({ where: { id } });
    if (!existente || !existente.activo) return res.status(404).json({ message: 'Feriado não encontrado' });
    const { nome, data, tipo } = req.body || {};
    let novoDia = diaCalendario(existente.data);
    let novoTipo = existente.tipo;
    if (nome !== undefined) {
      if (typeof nome !== 'string') return res.status(400).json({ message: 'nome inválido' });
      const nomeTrim = nome.trim();
      if (nomeTrim.length === 0) return res.status(400).json({ message: 'nome é obrigatório' });
      if (nomeTrim.length > 100) return res.status(400).json({ message: 'nome não pode ter mais de 100 caracteres' });
      req.body._nomeTrim = nomeTrim;
    }
    if (tipo !== undefined) {
      if (!TIPOS_FERIADO.includes(tipo)) return res.status(400).json({ message: 'tipo inválido' });
      novoTipo = tipo;
    }
    if (data !== undefined) {
      const dia = diaCalendario(data);
      if (!dia) return res.status(400).json({ message: 'data inválida' });
      novoDia = dia;
    }
    if (novoTipo === 'feriado') {
      const [, m, d] = novoDia.split('-').map(Number);
      if (m === 2 && d === 29) {
        return res.status(400).json({ message: 'Não é permitido registar 29/02 como feriado anual.' });
      }
    }
    const outros = await prisma.feriado.findMany({ where: { activo: true, id: { not: id } } });
    for (const ex of outros) {
      if (feriadoCobre(ex, novoDia)) {
        return res.status(409).json({ message: `Já existe um feriado efectivo nesta data: ${ex.nome} (${fmtBR(diaCalendario(ex.data))}, ${ex.tipo}).` });
      }
    }
    const atualizado = await prisma.feriado.update({
      where: { id },
      data: {
        ...(req.body._nomeTrim !== undefined ? { nome: req.body._nomeTrim } : {}),
        ...(data !== undefined ? { data: parseISODate(novoDia) } : {}),
        ...(tipo !== undefined ? { tipo: novoTipo } : {}),
        actualizado_em: new Date(),
      },
    });
    const afectadas = await sessoesAfectadasPorFeriado(novoDia, novoTipo);
    res.json({ ...toFeriadoGet(atualizado), sessoes_afectadas_count: afectadas.reduce((acc, a) => acc + (a.sessoes?.length || 0), 0), actividades_afectadas: afectadas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Já existe um feriado nesta data.' });
    }
    next(err);
  }
});

// DELETE /configuracao/feriados/:id — Admin (soft delete)
router.delete('/feriados/:id', rbac('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existente = await prisma.feriado.findUnique({ where: { id } });
    if (!existente || !existente.activo) return res.status(404).json({ message: 'Feriado não encontrado' });
    await prisma.feriado.update({
      where: { id },
      data: { activo: false, actualizado_em: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /configuracao/geral — configurações gerais (linha única). Qualquer utilizador autenticado.
router.get('/geral', async (req, res, next) => {
  try {
    res.json(toConfiguracaoGeralGet(await obterConfiguracaoGeral()));
  } catch (err) {
    next(err);
  }
});

// PUT /configuracao/geral — só Admin. Body: { permitir_fim_semana?: boolean, permitir_feriados?: boolean }.
router.put('/geral', rbac('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const update = { activo: true };
    if (body.permitir_fim_semana !== undefined) {
      if (typeof body.permitir_fim_semana !== 'boolean') {
        return res.status(400).json({ message: 'permitir_fim_semana deve ser booleano' });
      }
      update.permitir_fim_semana = body.permitir_fim_semana;
    }
    if (body.permitir_feriados !== undefined) {
      if (typeof body.permitir_feriados !== 'boolean') {
        return res.status(400).json({ message: 'permitir_feriados deve ser booleano' });
      }
      update.permitir_feriados = body.permitir_feriados;
    }
    if (Object.keys(update).length === 1) {
      return res.status(400).json({ message: 'Nenhum campo válido para actualizar' });
    }
    const row = await prisma.configuracaoGeral.upsert({
      where: { id: CONFIGURACAO_GERAL_ID },
      create: { id: CONFIGURACAO_GERAL_ID, permitir_fim_semana: update.permitir_fim_semana ?? false, permitir_feriados: update.permitir_feriados ?? false },
      update,
    });
    res.json(toConfiguracaoGeralGet(row));
  } catch (err) {
    next(err);
  }
});

export default router;