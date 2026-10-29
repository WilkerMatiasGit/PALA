#!/usr/bin/env node
/**
 * Matriz reutilizável de validação de SESSÕES nos 4 pontos de escrita:
 *   POST /actividades/full · PUT /actividades/:id/full
 *   POST /agendamentos     · PUT /agendamentos/:id
 *
 * Regras cobertas (cada uma tem de devolver 400):
 *   1. participantes abaixo do mínimo activo do tipo
 *   2. participantes acima do máximo activo do tipo
 *   3. participantes acima da capacidade do laboratório
 *   4. sessão fora do período de projeto/estágio
 *   5. sessão no passado
 *   6. sessão a sábado/domingo (com permitir_fim_semana=false)
 *   7. sessão num feriado (com permitir_feriados=false)
 *
 * Extras:
 *   A. RF13 — choque com sessão aprovada (POST e PUT /actividades/:id/full → 409)
 *   B. stock — material acima do stock (PUT /actividades/:id/full → 400)
 *
 * Regras de segurança:
 *   - Cria apenas dados próprios com o prefixo TESTE-MATRIZ-<run>: atividades,
 *     sessões, feriados, 2 laboratórios e 1 material (com stock inicial).
 *   - No fim apaga APENAS os ids que criou (nunca por prefixo) — incluindo as
 *     sessões/aprovações fabricadas para o teste RF13, os laboratórios, o material
 *     e os respectivos movimentos de stock.
 *   - Guarda e repõe `configuracoes_gerais` no fim (mesmo com --keep).
 *   - Não escreve em dados de terceiros; só lê limites e catálogos.
 *   - Sobe o Express em processo, numa porta efémera (não precisa do servidor
 *     de desenvolvimento a correr).
 *
 * Uso:
 *   node server/scripts/matriz-validacoes-sessoes.mjs
 *   node server/scripts/matriz-validacoes-sessoes.mjs --keep   # não apaga no fim
 *
 * Env opcional: MATRIZ_EMAIL (default cpereira@isptec.co.ao), MATRIZ_SENHA (default 12345678).
 * Sai com código 1 se alguma verificação falhar.
 */
import { once } from 'node:events';
import app from '../src/app.js';
import { initDb, prisma } from '../src/db.js';

const KEEP = process.argv.includes('--keep');
const RUN = `TESTE-MATRIZ-${Date.now()}`;
const EMAIL = process.env.MATRIZ_EMAIL || 'cpereira@isptec.co.ao';
const SENHA = process.env.MATRIZ_SENHA || '12345678';

const created = { actividades: new Set(), feriados: new Set(), laboratorios: new Set(), materiais: new Set() };
const results = [];
const failures = [];
const skipped = [];
let baseUrl = '';
let server;
let token;
let configSnapshot;
let configMutated = false;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtBR = (day) => String(day).split('-').reverse().join('/');
const at = (day, hour = '09:00:00') => `${day}T${hour}`;
const startOfToday = () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

function nextWeekdayOnOrAfter(day) {
  let d = new Date(day);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

function firstWeekdayBetween(start, end) {
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) return d;
  }
  return null;
}

function nextSaturday() {
  let d = startOfToday();
  while (d.getDay() !== 6) d = addDays(d, 1);
  return d;
}

async function api(method, path, body, authToken) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* sem corpo */
  }
  return { status: res.status, json };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function expectStatus(name, response, expected, includesText) {
  const text = response.json?.message ? ` | ${response.json.message}` : '';
  const okStatus = response.status === expected;
  const okText = includesText ? String(response.json?.message || '').includes(includesText) : true;
  record(name, okStatus && okText, `HTTP ${response.status}${text}`);
  return okStatus && okText;
}

async function login(email, senha) {
  const r = await api('POST', '/user/login', { email, senha });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.token;
}

async function createFull(body, label) {
  const r = await api('POST', '/actividades/full', body, token);
  if (r.status === 201 && r.json?.id) created.actividades.add(r.json.id);
  return { ...r, label };
}

async function sessionsOf(actId) {
  const r = await api('GET', `/actividades/${actId}/agendamentos`, undefined, token);
  return Array.isArray(r.json) ? r.json.filter((g) => g.activo !== false) : [];
}

async function cleanup() {
  // Repõe sempre a configuração (mesmo com --keep).
  if (configSnapshot) {
    try {
      await prisma.configuracaoGeral.update({
        where: { id: 1 },
        data: {
          permitir_fim_semana: configSnapshot.permitir_fim_semana,
          permitir_feriados: configSnapshot.permitir_feriados,
        },
      });
    } catch (e) {
      console.error('[cleanup] falha ao repor configuração:', e.message);
    }
  }
  if (KEEP) {
    console.log('\n[--keep] Dados criados preservados:');
    console.log(
      JSON.stringify(
        {
          actividades: [...created.actividades],
          feriados: [...created.feriados],
          laboratorios: [...created.laboratorios],
          materiais: [...created.materiais],
        },
        null,
        1,
      ),
    );
    return;
  }

  const actIds = [...created.actividades];
  const holIds = [...created.feriados];
  const matIds = [...created.materiais];
  const labIds = [...created.laboratorios];
  const del = {};
  try {
    const ags = actIds.length
      ? await prisma.agendamento.findMany({ where: { actividade_id: { in: actIds } }, select: { id: true } })
      : [];
    const agIds = ags.map((a) => a.id);
    if (agIds.length) {
      del.decisoes = (await prisma.decisaoAgendamento.deleteMany({ where: { agendamento_id: { in: agIds } } })).count;
      del.tecnicos = (await prisma.agendamentoTecnico.deleteMany({ where: { agendamento_id: { in: agIds } } })).count;
      del.materiais = (await prisma.agendamentoMaterial.deleteMany({ where: { agendamento_id: { in: agIds } } })).count;
      del.historico = (await prisma.historicoMaterial.deleteMany({ where: { agendamento_id: { in: agIds } } })).count;
      del.agendamentos = (await prisma.agendamento.deleteMany({ where: { id: { in: agIds } } })).count;
    }
    if (actIds.length) {
      del.aulas = (await prisma.aula.deleteMany({ where: { actividade_id: { in: actIds } } })).count;
      del.visitas = (await prisma.visita.deleteMany({ where: { actividade_id: { in: actIds } } })).count;
      del.projectos = (await prisma.projecto.deleteMany({ where: { actividade_id: { in: actIds } } })).count;
      del.estagios = (await prisma.estagio.deleteMany({ where: { actividade_id: { in: actIds } } })).count;
      del.actividades = (await prisma.actividade.deleteMany({ where: { id: { in: actIds } } })).count;
    }
    if (holIds.length) {
      del.feriados = (await prisma.feriado.deleteMany({ where: { id: { in: holIds } } })).count;
    }
    if (matIds.length) {
      // movimentos do material próprio (inclui a compra inicial) e o material
      del.historicoMaterial = (await prisma.historicoMaterial.deleteMany({ where: { material_id: { in: matIds } } })).count;
      del.materiaisProprios = (await prisma.material.deleteMany({ where: { id: { in: matIds } } })).count;
    }
    if (labIds.length) {
      del.laboratorios = (await prisma.laboratorio.deleteMany({ where: { id: { in: labIds } } })).count;
    }
  } catch (e) {
    console.error('[cleanup] falha ao apagar ids criados:', e.message);
  }
  console.log('\n[cleanup] apagados (só ids criados):', JSON.stringify(del));
}

async function main() {
  await initDb();
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`[matriz] run=${RUN} server=${baseUrl}`);

  token = await login(EMAIL, SENHA);

  // ---------- configuração: guardar e bloquear fim de semana + feriados ----------
  const g = (await api('GET', '/configuracao/geral', undefined, token)).json;
  configSnapshot = { permitir_fim_semana: g.permitir_fim_semana, permitir_feriados: g.permitir_feriados };
  configMutated = true;
  const putCfg = await api(
    'PUT',
    '/configuracao/geral',
    { permitir_fim_semana: false, permitir_feriados: false },
    token,
  );
  if (putCfg.status !== 200) throw new Error(`não foi possível bloquear fim de semana/feriados: ${putCfg.status}`);

  // ---------- dados de referência (leitura) ----------
  const unidadeLab = await prisma.unidadeLaboratorial.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const categoriaMat = await prisma.categoriaMaterial.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const unidadeMat = await prisma.unidade.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  if (!unidadeLab) throw new Error('sem unidades laboratoriais activas');
  if (!categoriaMat || !unidadeMat) throw new Error('sem categoria/unidade de material activa');

  // Laboratórios e material PRÓPRIOS: a matriz fica isolada de sessões aprovadas e
  // de stock de terceiros (só ids criados aqui são apagados no fim).
  async function criarLab(nome, capacidade) {
    const r = await api('POST', '/labs', { nome, tipo: unidadeLab.nome, descricao: RUN, capacidade }, token);
    if (r.status !== 201 || !r.json?.id) throw new Error(`criar lab ${nome}: ${r.status} ${JSON.stringify(r.json)}`);
    created.laboratorios.add(r.json.id);
    return r.json;
  }
  const labMatriz = await criarLab(`${RUN}-LAB`, 40);
  const labCap = await criarLab(`${RUN}-LAB-CAP`, 10);

  const matCreate = await api(
    'POST',
    '/materiais',
    {
      laboratorio_id: labMatriz.id,
      nome: `${RUN}-MATERIAL`,
      categoria: categoriaMat.nome,
      quantidade_minima: 1,
      unidade: unidadeMat.nome,
      quantidade_inicial: 5,
    },
    token,
  );
  if (matCreate.status !== 201 || !matCreate.json?.id) {
    throw new Error(`criar material: ${matCreate.status} ${JSON.stringify(matCreate.json)}`);
  }
  created.materiais.add(matCreate.json.id);
  const materialProprio = { id: matCreate.json.id, quantidade: 5 };

  const limiteAula = await prisma.limiteParticipantes.findFirst({ where: { tipo: 'aula', activo: true } });
  const limiteProjecto = await prisma.limiteParticipantes.findFirst({ where: { tipo: 'projecto', activo: true } });
  const cd = await prisma.cursoDisciplina.findFirst({ where: { activo: true } });
  const professor = await prisma.utilizador.findFirst({ where: { tipo: 'professor', activo: true } });
  const admin = await prisma.utilizador.findFirst({ where: { email: EMAIL, activo: true } });
  const responsavelProjecto = professor?.id ?? admin?.id;
  if (!cd) throw new Error('sem curso_disciplinas activas (necessário para a regra de aula)');
  if (!professor) throw new Error('sem professor activo (necessário para o responsável de uma aula)');

  // ---------- feriado próprio (dia útil futuro, data exacta) ----------
  const today = startOfToday();
  let holiday = null;
  for (let i = 1; i <= 45 && !holiday; i++) {
    const d = addDays(today, i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const r = await api(
      'POST',
      '/configuracao/feriados',
      { nome: `${RUN}-FERIADO`, data: iso(d), tipo: 'ponte' },
      token,
    );
    if (r.status === 200 && r.json?.id) {
      created.feriados.add(r.json.id);
      holiday = { id: r.json.id, dia: iso(d) };
    } else if (r.status !== 409) {
      throw new Error(`falha ao criar feriado de teste: ${r.status} ${JSON.stringify(r.json)}`);
    }
  }
  if (!holiday) throw new Error('não foi possível criar um feriado de teste sem conflito');

  // ---------- atividades base ----------
  const periodStart = nextWeekdayOnOrAfter(addDays(today, 10));
  const periodEnd = addDays(periodStart, 10); // inclui dias úteis e o sábado seguinte
  const periodStartIso = iso(periodStart);
  const periodEndIso = iso(periodEnd);
  const startInside = firstWeekdayBetween(periodStart, periodEnd);
  if (!startInside) throw new Error('período de teste sem dia útil');

  const aulaDet = { curso_disciplina_id: cd.id, tema: `${RUN}-AULA`, turno: 'manha', numero_turma: 1 };
  const projLargoDet = {
    titulo: `${RUN}-PROJ-LARGO`,
    descricao: '',
    data_inicio: iso(today),
    data_fim: iso(addDays(today, 60)),
  };
  const projCurtoDet = {
    titulo: `${RUN}-PROJ-CURTO`,
    descricao: '',
    data_inicio: periodStartIso,
    data_fim: periodEndIso,
  };

  const aulaAg = { hora_inicio: at(iso(startOfToday()), '09:00:00'), hora_fim: at(iso(startOfToday()), '10:00:00'), num_participantes: 10 };

  const A = await createFull(
    {
      nome: `${RUN}-AULA-BASE`,
      laboratorio_id: labMatriz.id,
      tipo: 'aula',
      responsavel_id: professor.id,
      detalhes: aulaDet,
      agendamentos: [{ ...aulaAg, hora_inicio: at(iso(startInside), '09:00:00'), hora_fim: at(iso(startInside), '10:00:00') }],
    },
    'A',
  );
  const P1 = await createFull(
    {
      nome: `${RUN}-PROJ-LARGO`,
      laboratorio_id: labMatriz.id,
      tipo: 'projecto',
      responsavel_id: responsavelProjecto,
      detalhes: projLargoDet,
      agendamentos: [{ hora_inicio: at(iso(startInside), '09:00:00'), hora_fim: at(iso(startInside), '10:00:00'), num_participantes: 5 }],
    },
    'P1',
  );
  const P2 = await createFull(
    {
      nome: `${RUN}-PROJ-CURTO`,
      laboratorio_id: labMatriz.id,
      tipo: 'projecto',
      responsavel_id: responsavelProjecto,
      detalhes: projCurtoDet,
      agendamentos: [{ hora_inicio: at(iso(startInside), '09:00:00'), hora_fim: at(iso(startInside), '10:00:00'), num_participantes: 5 }],
    },
    'P2',
  );
  // P3 vive no laboratório de capacidade reduzida (regra "acima da capacidade").
  const P3 = await createFull(
    {
      nome: `${RUN}-PROJ-CAP`,
      laboratorio_id: labCap.id,
      tipo: 'projecto',
      responsavel_id: responsavelProjecto,
      detalhes: projCurtoDet,
      agendamentos: [{ hora_inicio: at(iso(startInside), '09:00:00'), hora_fim: at(iso(startInside), '10:00:00'), num_participantes: 5 }],
    },
    'P3',
  );
  if (![A, P1, P2, P3].every((r) => r.status === 201)) {
    throw new Error(`atividades base: ${JSON.stringify({ A, P1, P2, P3 })}`);
  }
  const sessA = (await sessionsOf(A.json.id))[0];
  const sessP1 = (await sessionsOf(P1.json.id))[0];
  const sessP2 = (await sessionsOf(P2.json.id))[0];
  const sessP3 = (await sessionsOf(P3.json.id))[0];
  if (!sessA || !sessP1 || !sessP2 || !sessP3) throw new Error('sessões base não criadas');

  // ---------- construtores de payload ----------
  const aulaBody = (ag) => ({
    nome: `${RUN}-POST-AULA`,
    laboratorio_id: labMatriz.id,
    tipo: 'aula',
    responsavel_id: professor.id,
    detalhes: aulaDet,
    agendamentos: [ag],
  });
  const projBody = (labId, det, ag) => ({
    nome: `${RUN}-POST-PROJ`,
    laboratorio_id: labId,
    tipo: 'projecto',
    responsavel_id: responsavelProjecto,
    detalhes: det,
    agendamentos: [ag],
  });
  const aulaPut = (ag) => ({ tipo: 'aula', laboratorio_id: labMatriz.id, detalhes: aulaDet, agendamentos: [ag] });
  const projPut = (labId, det, ag) => ({ tipo: 'projecto', laboratorio_id: labId, detalhes: det, agendamentos: [ag] });

  const validAulaParticipants = (() => {
    const min = limiteAula && limiteAula.limite_activo ? limiteAula.min : 1;
    const max = limiteAula && limiteAula.limite_activo ? Math.min(labMatriz.capacidade, limiteAula.max) : labMatriz.capacidade;
    return Math.min(Math.max(5, min), max);
  })();
  const validProjectParticipants = (() => {
    const min = limiteProjecto && limiteProjecto.limite_activo ? limiteProjecto.min : 1;
    const max = limiteProjecto && limiteProjecto.limite_activo ? Math.min(labMatriz.capacidade, limiteProjecto.max) : labMatriz.capacidade;
    return Math.min(Math.max(5, min), max);
  })();

  const weekday = iso(nextWeekdayOnOrAfter(addDays(today, 2)));
  const saturday = iso(nextSaturday());

  const rules = [];
  if (limiteAula && limiteAula.limite_activo) {
    if (limiteAula.min > 1) {
      rules.push({
        key: 'abaixo_minimo',
        expect: 'inferior ao mínimo',
        postFull: aulaBody({ hora_inicio: at(weekday, '11:00:00'), hora_fim: at(weekday, '12:00:00'), num_participantes: limiteAula.min - 1 }),
        putFull: { id: A.json.id, body: aulaPut({ hora_inicio: at(weekday, '11:00:00'), hora_fim: at(weekday, '12:00:00'), num_participantes: limiteAula.min - 1 }) },
        postAg: { actividade_id: A.json.id, hora_inicio: at(weekday, '11:00:00'), hora_fim: at(weekday, '12:00:00'), num_participantes: limiteAula.min - 1 },
        putAg: { id: sessA.id, body: { num_participantes: limiteAula.min - 1 } },
      });
    } else {
      skipped.push('abaixo_minimo: o mínimo activo de aula é 1 (não há valor válido abaixo)');
    }
    if (limiteAula.max < labMatriz.capacidade) {
      rules.push({
        key: 'acima_maximo',
        expect: 'superior ao máximo',
        postFull: aulaBody({ hora_inicio: at(weekday, '12:00:00'), hora_fim: at(weekday, '13:00:00'), num_participantes: limiteAula.max + 1 }),
        putFull: { id: A.json.id, body: aulaPut({ hora_inicio: at(weekday, '12:00:00'), hora_fim: at(weekday, '13:00:00'), num_participantes: limiteAula.max + 1 }) },
        postAg: { actividade_id: A.json.id, hora_inicio: at(weekday, '12:00:00'), hora_fim: at(weekday, '13:00:00'), num_participantes: limiteAula.max + 1 },
        putAg: { id: sessA.id, body: { num_participantes: limiteAula.max + 1 } },
      });
    } else {
      skipped.push('acima_maximo: o máximo activo de aula é igual à capacidade (o caso cai em acima_capacidade)');
    }
  } else {
    skipped.push('abaixo_minimo/acima_maximo: não há limite activo para aula');
  }

  rules.push(
    {
      key: 'acima_capacidade',
      expect: 'superior',
      postFull: projBody(labCap.id, projCurtoDet, { hora_inicio: at(iso(startInside), '13:00:00'), hora_fim: at(iso(startInside), '14:00:00'), num_participantes: labCap.capacidade + 1 }),
      putFull: { id: P3.json.id, body: projPut(labCap.id, projCurtoDet, { hora_inicio: at(iso(startInside), '13:00:00'), hora_fim: at(iso(startInside), '14:00:00'), num_participantes: labCap.capacidade + 1 }) },
      postAg: { actividade_id: P3.json.id, hora_inicio: at(iso(startInside), '13:00:00'), hora_fim: at(iso(startInside), '14:00:00'), num_participantes: labCap.capacidade + 1 },
      putAg: { id: sessP3.id, body: { num_participantes: labCap.capacidade + 1 } },
    },
    {
      key: 'fora_periodo',
      expect: 'fora do período',
      postFull: projBody(labMatriz.id, projCurtoDet, { hora_inicio: at(iso(addDays(periodEnd, 5)), '09:00:00'), hora_fim: at(iso(addDays(periodEnd, 5)), '10:00:00'), num_participantes: validProjectParticipants }),
      putFull: { id: P2.json.id, body: projPut(labMatriz.id, projCurtoDet, { hora_inicio: at(iso(addDays(periodEnd, 5)), '09:00:00'), hora_fim: at(iso(addDays(periodEnd, 5)), '10:00:00'), num_participantes: validProjectParticipants }) },
      postAg: { actividade_id: P2.json.id, hora_inicio: at(iso(addDays(periodEnd, 5)), '09:00:00'), hora_fim: at(iso(addDays(periodEnd, 5)), '10:00:00'), num_participantes: validProjectParticipants },
      putAg: { id: sessP2.id, body: { hora_inicio: at(iso(addDays(periodEnd, 5)), '09:00:00'), hora_fim: at(iso(addDays(periodEnd, 5)), '10:00:00') } },
    },
    {
      key: 'data_passada',
      expect: 'passado',
      postFull: projBody(labMatriz.id, projLargoDet, { hora_inicio: at(iso(addDays(today, -1)), '09:00:00'), hora_fim: at(iso(addDays(today, -1)), '10:00:00'), num_participantes: validProjectParticipants }),
      putFull: { id: P2.json.id, body: projPut(labMatriz.id, projCurtoDet, { hora_inicio: at(iso(addDays(today, -1)), '09:00:00'), hora_fim: at(iso(addDays(today, -1)), '10:00:00'), num_participantes: validProjectParticipants }) },
      postAg: { actividade_id: P1.json.id, hora_inicio: at(iso(addDays(today, -1)), '09:00:00'), hora_fim: at(iso(addDays(today, -1)), '10:00:00'), num_participantes: validProjectParticipants },
      putAg: { id: sessP1.id, body: { hora_inicio: at(iso(addDays(today, -1)), '09:00:00'), hora_fim: at(iso(addDays(today, -1)), '10:00:00') } },
    },
    {
      key: 'sabado',
      expect: 'fim de semana',
      postFull: projBody(labMatriz.id, projLargoDet, { hora_inicio: at(saturday, '09:00:00'), hora_fim: at(saturday, '10:00:00'), num_participantes: validProjectParticipants }),
      putFull: { id: P1.json.id, body: projPut(labMatriz.id, projLargoDet, { hora_inicio: at(saturday, '09:00:00'), hora_fim: at(saturday, '10:00:00'), num_participantes: validProjectParticipants }) },
      postAg: { actividade_id: P1.json.id, hora_inicio: at(saturday, '09:00:00'), hora_fim: at(saturday, '10:00:00'), num_participantes: validProjectParticipants },
      putAg: { id: sessP1.id, body: { hora_inicio: at(saturday, '09:00:00'), hora_fim: at(saturday, '10:00:00') } },
    },
    {
      key: 'feriado',
      expect: 'nesta data',
      postFull: projBody(labMatriz.id, projLargoDet, { hora_inicio: at(holiday.dia, '09:00:00'), hora_fim: at(holiday.dia, '10:00:00'), num_participantes: validProjectParticipants }),
      putFull: { id: P1.json.id, body: projPut(labMatriz.id, projLargoDet, { hora_inicio: at(holiday.dia, '09:00:00'), hora_fim: at(holiday.dia, '10:00:00'), num_participantes: validProjectParticipants }) },
      postAg: { actividade_id: P1.json.id, hora_inicio: at(holiday.dia, '09:00:00'), hora_fim: at(holiday.dia, '10:00:00'), num_participantes: validProjectParticipants },
      putAg: { id: sessP1.id, body: { hora_inicio: at(holiday.dia, '09:00:00'), hora_fim: at(holiday.dia, '10:00:00') } },
    },
  );

  // ---------- matriz ----------
  for (const rule of rules) {
    console.log(`\n[matriz] ${rule.key} (dia útil ${weekday}, sábado ${saturday}, feriado ${holiday.dia})`);
    const r1 = await api('POST', '/actividades/full', rule.postFull, token);
    if (r1.status === 201 && r1.json?.id) created.actividades.add(r1.json.id);
    expectStatus(`${rule.key} · POST /actividades/full`, r1, 400, rule.expect);

    const r2 = await api('PUT', `/actividades/${rule.putFull.id}/full`, rule.putFull.body, token);
    expectStatus(`${rule.key} · PUT /actividades/:id/full`, r2, 400, rule.expect);

    const r3 = await api('POST', '/agendamentos', rule.postAg, token);
    expectStatus(`${rule.key} · POST /agendamentos`, r3, 400, rule.expect);

    const r4 = await api('PUT', `/agendamentos/${rule.putAg.id}`, rule.putAg.body, token);
    expectStatus(`${rule.key} · PUT /agendamentos/:id`, r4, 400, rule.expect);
  }

  // As sessões base têm de continuar intactas (nenhum PUT rejeitado pode gravar).
  const afterA = await sessionsOf(A.json.id);
  const afterP1 = await sessionsOf(P1.json.id);
  const afterP2 = await sessionsOf(P2.json.id);
  const afterP3 = await sessionsOf(P3.json.id);
  record(
    'sessões base intactas após a matriz',
    afterA.length === 1 && afterP1.length === 1 && afterP2.length === 1 && afterP3.length === 1 && afterA[0].id === sessA.id && afterP1[0].id === sessP1.id && afterP2[0].id === sessP2.id && afterP3[0].id === sessP3.id,
    `A=${afterA.length}, P1=${afterP1.length}, P2=${afterP2.length}, P3=${afterP3.length}`,
  );

  // ---------- A. RF13 — choque com sessão aprovada (dados próprios) ----------
  const choqueDay = iso(nextWeekdayOnOrAfter(addDays(today, 50)));
  const R = await createFull(
    {
      nome: `${RUN}-RF13-APROVADA`,
      laboratorio_id: labMatriz.id,
      tipo: 'projecto',
      responsavel_id: responsavelProjecto,
      detalhes: projLargoDet,
      agendamentos: [{ hora_inicio: at(choqueDay, '03:00:00'), hora_fim: at(choqueDay, '04:00:00'), num_participantes: validProjectParticipants }],
    },
    'R',
  );
  if (R.status === 201) {
    const sessR = (await sessionsOf(R.json.id))[0];
    // Fabrica o estado aprovado APENAS na sessão própria, para testar a RF13 sem
    // depender de dados de terceiros. É apagada no cleanup (id criado aqui).
    await prisma.agendamento.update({ where: { id: sessR.id }, data: { estado: 'aprovado_supervisor' } });
    const R2 = await createFull(
      {
        nome: `${RUN}-RF13-EDIT`,
        laboratorio_id: labMatriz.id,
        tipo: 'projecto',
        responsavel_id: responsavelProjecto,
        detalhes: projLargoDet,
        agendamentos: [{ hora_inicio: at(choqueDay, '04:00:00'), hora_fim: at(choqueDay, '05:00:00'), num_participantes: validProjectParticipants }],
      },
      'R2',
    );
    expectStatus(
      'RF13 · POST /actividades/full (choque)',
      await api(
        'POST',
        '/actividades/full',
        {
          nome: `${RUN}-RF13-POST`,
          laboratorio_id: labMatriz.id,
          tipo: 'projecto',
          responsavel_id: responsavelProjecto,
          detalhes: projLargoDet,
          agendamentos: [{ hora_inicio: at(choqueDay, '03:30:00'), hora_fim: at(choqueDay, '04:30:00'), num_participantes: validProjectParticipants }],
        },
        token,
      ),
      409,
      'Choque de horário',
    );
    if (R2.status === 201) {
      expectStatus(
        'RF13 · PUT /actividades/:id/full (choque)',
        await api(
          'PUT',
          `/actividades/${R2.json.id}/full`,
          projPut(labMatriz.id, projLargoDet, { hora_inicio: at(choqueDay, '03:30:00'), hora_fim: at(choqueDay, '04:30:00'), num_participantes: validProjectParticipants }),
          token,
        ),
        409,
        'Choque de horário',
      );
    } else {
      record('RF13 · PUT /actividades/:id/full (choque)', false, `não foi possível criar a atividade de edição: HTTP ${R2.status}`);
    }
  } else {
    record('RF13 · POST /actividades/full (choque)', false, `não foi possível criar a atividade aprovada: HTTP ${R.status}`);
  }

  // ---------- B. stock no PUT /full (material próprio, quantidade inicial 5) ----------
  const material = materialProprio;
  const stockDay = iso(nextWeekdayOnOrAfter(addDays(today, 65)));
  const detStock = { titulo: `${RUN}-STOCK`, descricao: '', data_inicio: iso(today), data_fim: iso(addDays(today, 90)) };
  const stockCreate = await createFull(
    {
      nome: `${RUN}-STOCK`,
      laboratorio_id: labMatriz.id,
      tipo: 'projecto',
      responsavel_id: responsavelProjecto,
      detalhes: detStock,
      agendamentos: [{ hora_inicio: at(stockDay, '04:00:00'), hora_fim: at(stockDay, '05:00:00'), num_participantes: validProjectParticipants, materiais: [{ material_id: material.id, quantidade_estimada: 1 }] }],
    },
    'STOCK',
  );
  if (stockCreate.status === 201) {
    expectStatus(
      'stock · PUT /actividades/:id/full (acima do stock)',
      await api(
        'PUT',
        `/actividades/${stockCreate.json.id}/full`,
        projPut(labMatriz.id, detStock, {
          hora_inicio: at(stockDay, '04:00:00'),
          hora_fim: at(stockDay, '05:00:00'),
          num_participantes: validProjectParticipants,
          materiais: [{ material_id: material.id, quantidade_estimada: material.quantidade + 1 }],
        }),
        token,
      ),
      400,
      'Stock insuficiente',
    );
  } else {
    record('stock · PUT /actividades/:id/full (acima do stock)', false, `criação falhou: HTTP ${stockCreate.status} ${stockCreate.json?.message || ''}`);
  }

  // ---------- resumo ----------
  console.log('\n================ RESUMO ================');
  console.log(`run: ${RUN}`);
  console.log(`verificações: ${results.length} | pass: ${results.filter((r) => r.ok).length} | fail: ${failures.length}`);
  if (skipped.length) console.log('saltadas:', skipped.join(' | '));
  for (const f of failures) console.log(`FAIL: ${f.name} — ${f.detail}`);
  return failures.length === 0 ? 0 : 1;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (e) {
  console.error('\n[matriz] erro fatal:', e && e.stack ? e.stack : e);
  exitCode = 1;
} finally {
  if (configMutated) await cleanup();
  if (server) {
    server.close();
    await once(server, 'close').catch(() => {});
  }
  await prisma.$disconnect();
}
process.exit(exitCode);
