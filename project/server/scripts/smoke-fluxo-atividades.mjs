#!/usr/bin/env node
/**
 * Smoke end-to-end POR TIPO de atividade: CRUD + ciclo de aprovação/presença.
 *
 * Cobre os 4 tipos (aula, visita, projecto, estagio) e todos os caminhos do fluxo:
 *   - aula:    POST /full → GET → PUT /:id → PUT /:id/full → DLab aprova →
 *              Supervisor aprova (com técnicos) → calendário → confirmar professor →
 *              confirmar técnico → realizado + baixa de stock (idempotente) →
 *              bloqueios RF08c (409) após decisões.
 *   - visita:  POST /full → GET visita → PUT /:id/full → "Deixar pendente" (DLab) →
 *              Supervisor aprova a sessão pendente.
 *   - projeto: POST /full → GET projeto → upsert POST /projectos → rejeição
 *              individual (DLab) → atividade rejeitada.
 *   - estagio: POST /full → GET estagio → upsert POST /estagios →
 *              POST /aprovacoes/:id/rejeitar → todas as sessões rejeitadas.
 *   - extra:   DELETE /actividades/:id (soft delete) numa aula sem decisões.
 *
 * Segurança: cria apenas dados próprios (prefixo TESTE-FLUXO-<run>) — 1 laboratório,
 * 1 material (stock 10) e as atividades abaixo. No fim apaga APENAS os ids criados
 * (decisões, técnicos, materiais pedidos, histórico de stock, sessões, especialidades,
 * atividades, material e laboratório) e repõe `configuracoes_gerais`.
 *
 * Uso:  node server/scripts/smoke-fluxo-atividades.mjs [--keep]
 *
 * Escreve na base de dados configurada em `.env` (a mesma do servidor). No fim
 * apaga apenas os ids que criou; com `--keep` preserva-os para inspecção.
 *
 * Credenciais de seed (podem ser trocadas por env):
 *   SMOKE_ADMIN_EMAIL   (default cpereira@isptec.co.ao)
 *   SMOKE_PROF_EMAIL    (default palmeida@isptec.co.ao)
 *   SMOKE_TECNICO_EMAIL (default amartins@isptec.co.ao)
 *   SMOKE_COORD_EMAIL   (default msantos@isptec.co.ao)
 *   SMOKE_SUP_EMAIL     (default rfernandes@isptec.co.ao)
 *   SMOKE_SENHA         (default 12345678)
 *
 * Sai com código 1 se alguma verificação falhar.
 */
import { once } from 'node:events';
import app from '../src/app.js';
import { initDb, prisma } from '../src/db.js';

const KEEP = process.argv.includes('--keep');
const RUN = `TESTE-FLUXO-${Date.now()}`;
const EMAILS = {
  admin: process.env.SMOKE_ADMIN_EMAIL || 'cpereira@isptec.co.ao',
  prof: process.env.SMOKE_PROF_EMAIL || 'palmeida@isptec.co.ao',
  tecnico: process.env.SMOKE_TECNICO_EMAIL || 'amartins@isptec.co.ao',
  coord: process.env.SMOKE_COORD_EMAIL || 'msantos@isptec.co.ao',
  sup: process.env.SMOKE_SUP_EMAIL || 'rfernandes@isptec.co.ao',
};
const SENHA = process.env.SMOKE_SENHA || '12345678';

const created = { actividades: new Set(), laboratorios: new Set(), materiais: new Set() };
const results = [];
const failures = [];

let server;
let baseUrl = '';
let configSnapshot;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const at = (day, hour = '09:00:00') => `${day}T${hour}`;

function weekdayFrom(offset) {
  const today = new Date();
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return d;
}

async function api(method, path, body, token) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204 / sem corpo */
  }
  return { status: res.status, json };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function check(name, condition, detail) {
  record(name, Boolean(condition), detail);
  return Boolean(condition);
}

async function login(email) {
  const r = await api('POST', '/user/login', { email, senha: SENHA });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.token;
}

async function createFull(token, body) {
  const r = await api('POST', '/actividades/full', body, token);
  if (r.status === 201 && r.json?.id) created.actividades.add(r.json.id);
  return r;
}

async function sessionsOf(actId, token) {
  const r = await api('GET', `/actividades/${actId}/agendamentos`, undefined, token);
  return Array.isArray(r.json) ? r.json.filter((g) => g.activo !== false) : [];
}

async function estadoActividade(actId, token) {
  const r = await api('GET', `/actividades/${actId}`, undefined, token);
  return { status: r.status, estado: r.json?.estado, json: r.json };
}

async function cleanup() {
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
    console.log(
      '\n[--keep] preservado:',
      JSON.stringify({
        actividades: [...created.actividades],
        laboratorios: [...created.laboratorios],
        materiais: [...created.materiais],
      }),
    );
    return;
  }

  const actIds = [...created.actividades];
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
    if (matIds.length) {
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
  console.log(`[fluxo] run=${RUN} server=${baseUrl}`);

  const tokens = {
    admin: await login(EMAILS.admin),
    prof: await login(EMAILS.prof),
    tecnico: await login(EMAILS.tecnico),
    coord: await login(EMAILS.coord),
    sup: await login(EMAILS.sup),
  };

  const g = (await api('GET', '/configuracao/geral', undefined, tokens.admin)).json;
  configSnapshot = { permitir_fim_semana: g.permitir_fim_semana, permitir_feriados: g.permitir_feriados };
  const putCfg = await api(
    'PUT',
    '/configuracao/geral',
    { permitir_fim_semana: false, permitir_feriados: false },
    tokens.admin,
  );
  if (putCfg.status !== 200) throw new Error(`não foi possível fixar as regras: ${putCfg.status}`);

  const unidadeLab = await prisma.unidadeLaboratorial.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const categoriaMat = await prisma.categoriaMaterial.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const unidadeMat = await prisma.unidade.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const cd = await prisma.cursoDisciplina.findFirst({ where: { activo: true } });
  const estudante = await prisma.estudante.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const prof = await prisma.utilizador.findUnique({ where: { email: EMAILS.prof } });
  const tecnico = await prisma.utilizador.findUnique({ where: { email: EMAILS.tecnico } });
  if (!unidadeLab || !categoriaMat || !unidadeMat || !cd || !estudante || !prof || !tecnico) {
    throw new Error('faltam dados de referência (catálogos/curso-disciplina/estudante/utilizadores)');
  }

  const labR = await api(
    'POST',
    '/labs',
    { nome: `${RUN}-LAB`, tipo: unidadeLab.nome, descricao: RUN, capacidade: 40 },
    tokens.admin,
  );
  if (labR.status !== 201 || !labR.json?.id) throw new Error(`criar lab: ${labR.status} ${JSON.stringify(labR.json)}`);
  created.laboratorios.add(labR.json.id);
  const labId = labR.json.id;

  const matR = await api(
    'POST',
    '/materiais',
    {
      laboratorio_id: labId,
      nome: `${RUN}-MATERIAL`,
      categoria: categoriaMat.nome,
      quantidade_minima: 1,
      unidade: unidadeMat.nome,
      quantidade_inicial: 10,
    },
    tokens.admin,
  );
  if (matR.status !== 201 || !matR.json?.id) throw new Error(`criar material: ${matR.status} ${JSON.stringify(matR.json)}`);
  created.materiais.add(matR.json.id);
  const materialId = matR.json.id;

  const aulaDet = { curso_disciplina_id: cd.id, tema: `${RUN}-TEMA`, turno: 'manha', numero_turma: 3 };
  const aulaSessao = (day, participantes = 6) => ({
    hora_inicio: at(iso(day), '09:00:00'),
    hora_fim: at(iso(day), '11:00:00'),
    num_participantes: participantes,
    materiais: [{ material_id: materialId, quantidade_estimada: 2 }],
  });

  // ================= AULA =================
  const diaAula = weekdayFrom(10);
  const aula1 = await createFull(tokens.prof, {
    nome: `${RUN}-AULA`,
    responsavel_id: prof.id,
    laboratorio_id: labId,
    observacoes: '',
    tipo: 'aula',
    detalhes: aulaDet,
    agendamentos: [aulaSessao(diaAula)],
  });
  check('aula: POST /actividades/full → 201', aula1.status === 201 && aula1.json?.id, `HTTP ${aula1.status}`);
  const aulaId = aula1.json?.id;
  if (!aulaId) throw new Error('aula não criada');

  const aulaDetGet = await api('GET', `/actividades/${aulaId}/aula`, undefined, tokens.prof);
  check(
    'aula: detalhes (tema/turno/numero_turma/turma)',
    aulaDetGet.status === 200 &&
      aulaDetGet.json?.tema === aulaDet.tema &&
      aulaDetGet.json?.turno === 'manha' &&
      aulaDetGet.json?.numero_turma === 3 &&
      typeof aulaDetGet.json?.turma === 'string' &&
      aulaDetGet.json.turma.includes('3'),
    JSON.stringify({ tema: aulaDetGet.json?.tema, turma: aulaDetGet.json?.turma }),
  );

  const aulaGet = await estadoActividade(aulaId, tokens.prof);
  check(
    'aula: GET /actividades/:id (estado pendente + responsável)',
    aulaGet.status === 200 && aulaGet.estado === 'pendente' && aulaGet.json?.responsavel_nome === prof.nome,
    `HTTP ${aulaGet.status} estado=${aulaGet.estado}`,
  );

  const aulaPut = await api('PUT', `/actividades/${aulaId}`, { nome: `${RUN}-AULA-EDIT` }, tokens.prof);
  check('aula: PUT /actividades/:id (nome)', aulaPut.status === 200 && aulaPut.json?.nome === `${RUN}-AULA-EDIT`, `HTTP ${aulaPut.status}`);

  const aulaFull = await api(
    'PUT',
    `/actividades/${aulaId}/full`,
    {
      nome: `${RUN}-AULA-EDIT`,
      laboratorio_id: labId,
      tipo: 'aula',
      observacoes: '',
      detalhes: { ...aulaDet, tema: `${RUN}-TEMA-2`, numero_turma: 4 },
      agendamentos: [aulaSessao(diaAula, 7)],
    },
    tokens.prof,
  );
  check('aula: PUT /actividades/:id/full → 200', aulaFull.status === 200 && aulaFull.json?.nome === `${RUN}-AULA-EDIT`, `HTTP ${aulaFull.status}`);
  let aulaAgs = await sessionsOf(aulaId, tokens.prof);
  check(
    'aula: /full recriou a sessão (1 sessão, 7 participantes, em nao_revisto)',
    aulaAgs.length === 1 && aulaAgs[0].num_participantes === 7 && aulaAgs[0].estado === 'nao_revisto',
    JSON.stringify({ n: aulaAgs.length, p: aulaAgs[0]?.num_participantes, e: aulaAgs[0]?.estado }),
  );
  const aulaAgId = aulaAgs[0]?.id;

  const dlabAula = await api('POST', '/aprovacoes', { agendamento_id: aulaAgId, etapa: 'dlab', decisao: 'aprovado', comentario: '' }, tokens.coord);
  check('aula: DLab aprova → 201', dlabAula.status === 201, `HTTP ${dlabAula.status}`);
  aulaAgs = await sessionsOf(aulaId, tokens.prof);
  check('aula: DLab → sessão aprovado_dlab + atividade em_andamento', aulaAgs[0]?.estado === 'aprovado_dlab' && (await estadoActividade(aulaId, tokens.prof)).estado === 'em_andamento', `estado sessão=${aulaAgs[0]?.estado}`);

  const supSemTecnicos = await api('POST', '/aprovacoes', { agendamento_id: aulaAgId, etapa: 'supervisor', decisao: 'aprovado' }, tokens.sup);
  check('aula: Supervisor aprovar sem técnicos → 400', supSemTecnicos.status === 400, `HTTP ${supSemTecnicos.status}`);

  const supAula = await api(
    'POST',
    '/aprovacoes',
    {
      agendamento_id: aulaAgId,
      etapa: 'supervisor',
      decisao: 'aprovado',
      comentario: 'ok',
      tecnicos: { validador_id: tecnico.id, assistente_id: tecnico.id },
    },
    tokens.sup,
  );
  check('aula: Supervisor aprova com técnicos → 201', supAula.status === 201, `HTTP ${supAula.status}`);
  aulaAgs = await sessionsOf(aulaId, tokens.prof);
  check(
    'aula: sessão aprovado_supervisor com validador/assistente',
    aulaAgs[0]?.estado === 'aprovado_supervisor' && aulaAgs[0]?.validador_id === tecnico.id && aulaAgs[0]?.assistente_id === tecnico.id,
    JSON.stringify({ estado: aulaAgs[0]?.estado, v: aulaAgs[0]?.validador_id }),
  );

  const diaIso = iso(diaAula);
  const cal = await api('GET', `/agendamentos?laboratorio_id=${labId}&de=${diaIso}&ate=${iso(addDays(diaAula, 1))}`, undefined, tokens.prof);
  const noCal = Array.isArray(cal.json) && cal.json.some((x) => x.id === aulaAgId);
  check('aula: aparece em GET /agendamentos (calendário) após aprovação', cal.status === 200 && noCal, `HTTP ${cal.status}`);

  const confProf = await api('PUT', `/agendamentos/${aulaAgId}/confirmar-professor`, undefined, tokens.prof);
  check('aula: confirmar professor → 200 e ainda não realizado', confProf.status === 200 && confProf.json?.realizado === false, `HTTP ${confProf.status}`);
  let matRow = await prisma.material.findUnique({ where: { id: materialId }, select: { quantidade: true } });
  check('aula: sem baixa de stock antes das duas confirmações', matRow?.quantidade === 10, `quantidade=${matRow?.quantidade}`);

  const confTec = await api('PUT', `/agendamentos/${aulaAgId}/confirmar-tecnico`, undefined, tokens.tecnico);
  check('aula: confirmar técnico → 200 realizado=true', confTec.status === 200 && confTec.json?.realizado === true, `HTTP ${confTec.status} realizado=${confTec.json?.realizado}`);
  matRow = await prisma.material.findUnique({ where: { id: materialId }, select: { quantidade: true } });
  const consumo = await prisma.historicoMaterial.findMany({
    where: { agendamento_id: aulaAgId, material_id: materialId },
    select: { quantidade_movimentada: true, motivo: true, descricao: true },
  });
  check(
    'aula: baixa de stock 10→8 com movimento consumo_actividade ligado à sessão',
    matRow?.quantidade === 8 && consumo.length === 1 && consumo[0].quantidade_movimentada === -2 && consumo[0].motivo === 'consumo_actividade',
    `quantidade=${matRow?.quantidade} movimentos=${JSON.stringify(consumo)}`,
  );
  check('aula: atividade fica realizada', (await estadoActividade(aulaId, tokens.prof)).estado === 'realizada', '');

  const confTec2 = await api('PUT', `/agendamentos/${aulaAgId}/confirmar-tecnico`, undefined, tokens.tecnico);
  matRow = await prisma.material.findUnique({ where: { id: materialId }, select: { quantidade: true } });
  const consumo2 = await prisma.historicoMaterial.count({ where: { agendamento_id: aulaAgId, material_id: materialId } });
  check(
    'aula: repetir confirmação é idempotente (stock 8, 1 movimento)',
    confTec2.status === 200 && matRow?.quantidade === 8 && consumo2 === 1,
    `HTTP ${confTec2.status} quantidade=${matRow?.quantidade} movimentos=${consumo2}`,
  );

  const delDecidida = await api('DELETE', `/actividades/${aulaId}`, undefined, tokens.prof);
  check('aula: DELETE após decisões → 409 (RF08c)', delDecidida.status === 409, `HTTP ${delDecidida.status}`);
  const putDecidida = await api(
    'PUT',
    `/actividades/${aulaId}/full`,
    { nome: 'x', laboratorio_id: labId, tipo: 'aula', detalhes: aulaDet, agendamentos: [aulaSessao(diaAula)] },
    tokens.prof,
  );
  check('aula: PUT /full após decisões → 409 (RF08c)', putDecidida.status === 409, `HTTP ${putDecidida.status}`);

  const aprovDet = await api('GET', `/aprovacoes/${aulaId}`, undefined, tokens.sup);
  check('aula: GET /aprovacoes/:id → pode_rejeitar_atividade=false', aprovDet.status === 200 && aprovDet.json?.pode_rejeitar_atividade === false, `HTTP ${aprovDet.status}`);

  // ================= VISITA =================
  const diaVisita = weekdayFrom(14);
  const visitaDet = {
    nome_visitante: `${RUN}-VISITANTE`,
    instituicao: `${RUN}-INST`,
    telefone: '923456789',
    email: 'teste@isptec.co.ao',
  };
  const visita = await createFull(tokens.prof, {
    nome: `${RUN}-VISITA`,
    responsavel_id: prof.id,
    laboratorio_id: labId,
    observacoes: '',
    tipo: 'visita',
    detalhes: visitaDet,
    agendamentos: [{ hora_inicio: at(iso(diaVisita), '09:00:00'), hora_fim: at(iso(diaVisita), '10:00:00'), num_participantes: 12 }],
  });
  check('visita: POST /actividades/full → 201', visita.status === 201 && visita.json?.id, `HTTP ${visita.status}`);
  const visitaId = visita.json?.id;
  if (!visitaId) throw new Error('visita não criada');

  const visitaDetGet = await api('GET', `/actividades/${visitaId}/visita`, undefined, tokens.prof);
  check(
    'visita: detalhes (telefone/email/nome_visitante)',
    visitaDetGet.status === 200 && visitaDetGet.json?.telefone === '923456789' && visitaDetGet.json?.email === visitaDet.email && visitaDetGet.json?.nome_visitante === visitaDet.nome_visitante,
    JSON.stringify({ tel: visitaDetGet.json?.telefone }),
  );

  const visitaFull = await api(
    'PUT',
    `/actividades/${visitaId}/full`,
    {
      nome: `${RUN}-VISITA-EDIT`,
      laboratorio_id: labId,
      tipo: 'visita',
      observacoes: '',
      detalhes: { ...visitaDet, instituicao: `${RUN}-INST-2` },
      agendamentos: [{ hora_inicio: at(iso(diaVisita), '11:00:00'), hora_fim: at(iso(diaVisita), '12:00:00'), num_participantes: 12 }],
    },
    tokens.prof,
  );
  check('visita: PUT /actividades/:id/full → 200', visitaFull.status === 200 && visitaFull.json?.nome === `${RUN}-VISITA-EDIT`, `HTTP ${visitaFull.status}`);
  const visitaDet2 = await api('GET', `/actividades/${visitaId}/visita`, undefined, tokens.prof);
  check('visita: detalhes actualizados via /full', visitaDet2.json?.instituicao === `${RUN}-INST-2`, `instituicao=${visitaDet2.json?.instituicao}`);
  const visitaAgs = await sessionsOf(visitaId, tokens.prof);
  const visitaAgId = visitaAgs[0]?.id;

  const pend = await api('POST', '/aprovacoes/pendente', { agendamento_id: visitaAgId }, tokens.coord);
  check('visita: "Deixar pendente" → 200', pend.status === 200, `HTTP ${pend.status}`);
  const visitaAgsP = await sessionsOf(visitaId, tokens.prof);
  check('visita: sessão fica pendente (sem decisão registada)', visitaAgsP[0]?.estado === 'pendente' && (await prisma.decisaoAgendamento.count({ where: { agendamento_id: visitaAgId } })) === 0, `estado=${visitaAgsP[0]?.estado}`);

  const supVisita = await api(
    'POST',
    '/aprovacoes',
    {
      agendamento_id: visitaAgId,
      etapa: 'supervisor',
      decisao: 'aprovado',
      comentario: '',
      tecnicos: { validador_id: tecnico.id, assistente_id: tecnico.id },
    },
    tokens.sup,
  );
  check(
    'visita: Supervisor aprova sessão que ficou pendente → 201',
    supVisita.status === 201 && (await sessionsOf(visitaId, tokens.prof))[0]?.estado === 'aprovado_supervisor',
    `HTTP ${supVisita.status}`,
  );

  // ================= PROJETO =================
  const diaProj = weekdayFrom(21);
  const projDet = {
    titulo: `${RUN}-PROJ`,
    descricao: 'descrição',
    data_inicio: iso(addDays(diaProj, -3)),
    data_fim: iso(addDays(diaProj, 3)),
  };
  const proj = await createFull(tokens.prof, {
    nome: `${RUN}-PROJETO`,
    responsavel_id: prof.id,
    laboratorio_id: labId,
    observacoes: '',
    tipo: 'projecto',
    detalhes: projDet,
    agendamentos: [{ hora_inicio: at(iso(diaProj), '09:00:00'), hora_fim: at(iso(diaProj), '10:00:00'), num_participantes: 4 }],
  });
  check('projecto: POST /actividades/full → 201', proj.status === 201 && proj.json?.id, `HTTP ${proj.status}`);
  const projId = proj.json?.id;
  if (!projId) throw new Error('projecto não criado');

  const projDetGet = await api('GET', `/actividades/${projId}/projecto`, undefined, tokens.prof);
  check('projecto: detalhes (titulo/data_inicio/data_fim)', projDetGet.status === 200 && projDetGet.json?.titulo === projDet.titulo, `HTTP ${projDetGet.status}`);

  const projUpsert = await api('POST', '/projectos', { actividade_id: projId, ...projDet, titulo: `${RUN}-PROJ-2` }, tokens.prof);
  check('projecto: upsert POST /projectos → 200 com título novo', projUpsert.status === 200 && projUpsert.json?.titulo === `${RUN}-PROJ-2`, `HTTP ${projUpsert.status}`);
  const projAgs = await sessionsOf(projId, tokens.prof);
  const rejProj = await api(
    'POST',
    '/aprovacoes',
    { agendamento_id: projAgs[0]?.id, etapa: 'dlab', decisao: 'rejeitado', comentario: 'não cumpre' },
    tokens.coord,
  );
  const projFinal = await estadoActividade(projId, tokens.prof);
  check(
    'projecto: rejeição individual (DLab) → sessão e atividade rejeitadas',
    rejProj.status === 201 && (await sessionsOf(projId, tokens.prof))[0]?.estado === 'rejeitado' && projFinal.estado === 'rejeitada',
    `HTTP ${rejProj.status} estado=${projFinal.estado}`,
  );

  // ================= ESTÁGIO =================
  const diaEst = weekdayFrom(28);
  const estDet = {
    estudante_id: estudante.id,
    data_inicio: iso(addDays(diaEst, -3)),
    data_fim: iso(addDays(diaEst, 3)),
  };
  const est = await createFull(tokens.prof, {
    nome: `${RUN}-ESTAGIO`,
    responsavel_id: prof.id,
    laboratorio_id: labId,
    observacoes: '',
    tipo: 'estagio',
    detalhes: estDet,
    agendamentos: [{ hora_inicio: at(iso(diaEst), '09:00:00'), hora_fim: at(iso(diaEst), '10:00:00'), num_participantes: 1 }],
  });
  check('estagio: POST /actividades/full → 201 (sem titulo/descricao)', est.status === 201 && est.json?.id, `HTTP ${est.status}`);
  const estId = est.json?.id;
  if (!estId) throw new Error('estágio não criado');

  const estDetGet = await api('GET', `/actividades/${estId}/estagio`, undefined, tokens.prof);
  check('estagio: detalhes (estudante_id + período)', estDetGet.status === 200 && Number(estDetGet.json?.estudante_id) === estudante.id, `HTTP ${estDetGet.status}`);

  const estUpsert = await api('POST', '/estagios', { actividade_id: estId, ...estDet }, tokens.prof);
  check('estagio: upsert POST /estagios → 200', estUpsert.status === 200, `HTTP ${estUpsert.status}`);

  const rejEst = await api('POST', `/aprovacoes/${estId}/rejeitar`, { comentario: 'encerrado' }, tokens.coord);
  const estFinal = await estadoActividade(estId, tokens.prof);
  const estAgs = await sessionsOf(estId, tokens.prof);
  check(
    'estagio: POST /aprovacoes/:id/rejeitar → todas as sessões rejeitadas + atividade rejeitada',
    rejEst.status === 200 && estAgs.length === 1 && estAgs[0].estado === 'rejeitado' && estFinal.estado === 'rejeitada',
    `HTTP ${rejEst.status} estado=${estFinal.estado}`,
  );

  // ================= DELETE (aula extra, sem decisões) =================
  const diaDel = weekdayFrom(35);
  const delAct = await createFull(tokens.prof, {
    nome: `${RUN}-AULA-DEL`,
    responsavel_id: prof.id,
    laboratorio_id: labId,
    observacoes: '',
    tipo: 'aula',
    detalhes: aulaDet,
    agendamentos: [{ hora_inicio: at(iso(diaDel), '09:00:00'), hora_fim: at(iso(diaDel), '10:00:00'), num_participantes: 6 }],
  });
  const delActId = delAct.json?.id;
  check('delete: aula extra criada → 201', delAct.status === 201 && delActId, `HTTP ${delAct.status}`);
  if (delActId) {
    const del = await api('DELETE', `/actividades/${delActId}`, undefined, tokens.prof);
    const depois = await api('GET', `/actividades/${delActId}`, undefined, tokens.prof);
    check('delete: DELETE /actividades/:id → 200 + GET passa a 404', del.status === 200 && depois.status === 404, `DELETE HTTP ${del.status} GET HTTP ${depois.status}`);
  }

  // ================= RESUMO =================
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[fluxo] ${passed}/${results.length} verificações passaram`);
  if (failures.length) {
    console.log('[fluxo] falhas:');
    for (const f of failures) console.log(`  - ${f.name} — ${f.detail}`);
  }
  return passed === results.length;
}

let code = 1;
try {
  code = (await main()) ? 0 : 1;
} catch (e) {
  console.error('[fluxo] erro fatal:', e);
  code = 1;
} finally {
  await cleanup().catch((e) => console.error('[cleanup] erro:', e.message));
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect().catch(() => {});
}
process.exit(code);
