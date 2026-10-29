import { prisma } from '../db.js';

// Erro com código HTTP (mesma convenção usada nas rotas de atividades).
const HTTP = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

// Dia de calendário no formato 'YYYY-MM-DD' (hora LOCAL do servidor), sem deslocar
// o dia. Aceita tanto strings "YYYY-MM-DD..." (submetidas pelo formulário, hora
// local naive) como Date (valores já guardados na base).
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

function hojeCalendario() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// 'YYYY-MM-DD' -> 'dd/mm/aaaa' (para as mensagens).
function fmtBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function tipoFeriadoRotulo(tipo) {
  if (tipo === 'feriado') return 'feriado';
  if (tipo === 'feriado_movel') return 'feriado móvel';
  if (tipo === 'ponte') return 'ponte';
  if (tipo === 'tolerancia') return 'tolerância de ponto';
  return tipo;
}

// Dia da semana (0=domingo … 6=sábado) a partir da DATA DE CALENDÁRIO 'YYYY-MM-DD',
// sem conversões de fuso: constrói-se a data em UTC a partir dos componentes e lê-se
// getUTCDay(). Nunca usar `new Date('aaaa-mm-dd')` + getDay() local.
function diaSemana(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function feriadoCobre(feriado, isoDia) {
  if (!feriado || !feriado.activo) return false;
  const [y, m, d] = isoDia.split('-').map(Number);
  if (feriado.tipo === 'feriado') {
    const fd = diaCalendario(feriado.data);
    if (!fd) return false;
    const [, fm, fdd] = fd.split('-').map(Number);
    return fm === m && fdd === d;
  }
  return diaCalendario(feriado.data) === isoDia;
}

export function motivoDiaBloqueado(isoDia, configuracao = {}, feriados = []) {
  if (!isoDia) return null;
  // fim de semana prevalece (uma só mensagem)
  if (configuracao && configuracao.permitir_fim_semana === false) {
    const dow = diaSemana(isoDia);
    if (dow === 0 || dow === 6) {
      return { tipo: 'fim_semana', mensagem: `Não é permitido agendar ao fim de semana (${fmtBR(isoDia)} é ${DIAS_SEMANA[dow]}).` };
    }
  }
  if (configuracao && configuracao.permitir_feriados === false) {
    for (const f of feriados) {
      if (feriadoCobre(f, isoDia)) {
        return { tipo: 'feriado', mensagem: `Não é permitido agendar nesta data: ${fmtBR(isoDia)} é ${tipoFeriadoRotulo(f.tipo)} (${f.nome}).` };
      }
    }
  }
  return null;
}

export async function obterFeriadosParaValidacao(client = prisma) {
  return client.feriado.findMany({ where: { activo: true }, orderBy: { data: 'asc' } });
}

// Vai buscar o período (data_inicio/data_fim) da especialização de uma atividade
// de projeto/estágio. Devolve null para os outros tipos (aula/visita não têm período).
export async function periodoDaActividade(act) {
  if (!act || (act.tipo !== 'projecto' && act.tipo !== 'estagio')) return null;
  const esp = act.tipo === 'projecto'
    ? await prisma.projecto.findFirst({
        where: { actividade_id: act.id, activo: true },
        select: { data_inicio: true, data_fim: true },
      })
    : await prisma.estagio.findFirst({
        where: { actividade_id: act.id, activo: true },
        select: { data_inicio: true, data_fim: true },
      });
  return esp ? { inicio: esp.data_inicio, fim: esp.data_fim } : null;
}

// Validação de uma SESSÃO (agendamento) na criação/solicitação.
//
// Regras atuais:
//  - participantes: capacidade do laboratório + min/max do tipo (RF20);
//  - data: a sessão tem de estar no futuro (o dia de hoje é permitido);
//  - período: quando `contexto.periodo` é indicado (projeto/estágio), a data da sessão
//    tem de estar dentro de [inicio, fim], inclusive. Aula e visita não têm período;
//  - fim de semana: quando `contexto.configuracao.permitir_fim_semana` é false, a data
//    não pode cair em sábado nem domingo;
//  - feriados: quando `contexto.configuracao.permitir_feriados` é false, a data não pode
//    cair em feriado/tipo coberto (regra 6), com mensagem clara (regra 7).
//
// `contexto` (opcional): { periodo?, configuracao?, feriados? }
//  - periodo: { inicio, fim } em 'YYYY-MM-DD' ou Date.
//  - configuracao: configurações gerais lidas UMA vez por pedido (obterConfiguracaoGeral);
//  - feriados: lista de feriados activos lida UMA vez por pedido (evita N consultas).
//
// Recebe o objecto completo da sessão (não só o nº de participantes) para que os
// próximos pedidos possam acrescentar validações (a partir de `hora_inicio`/`hora_fim`)
// sem alterar os chamadores.
export async function validarSessao(sessao, contexto = {}) {
  const { tipo, laboratorio_id, num_participantes } = sessao || {};
  const { periodo, configuracao, feriados } = contexto || {};

  const lab = await prisma.laboratorio.findUnique({ where: { id: Number(laboratorio_id) } });
  if (!lab || !lab.activo) throw HTTP(404, 'Laboratório não encontrado');

  const participantes = Number(num_participantes);
  if (!Number.isInteger(participantes) || participantes < 1) {
    throw HTTP(400, 'O número de participantes de cada sessão deve ser um inteiro maior que zero');
  }

  // Data da sessão: não pode estar no passado (hoje é permitido). Mesma definição
  // usada pelo front (`hojeISO()` local, comparando só o dia, sem hora limite).
  const dia = diaCalendario(sessao?.hora_inicio);
  if (dia && dia < hojeCalendario()) {
    throw HTTP(400, `A data da sessão (${fmtBR(dia)}) não pode estar no passado.`);
  }

  // Período do projeto/estágio: a sessão tem de ficar dentro de [inicio, fim].
  if (periodo && periodo.inicio && periodo.fim) {
    const ini = diaCalendario(periodo.inicio);
    const fim = diaCalendario(periodo.fim);
    if (dia && ini && fim && (dia < ini || dia > fim)) {
      const nome = tipo === 'estagio' ? 'do estágio' : 'do projeto';
      throw HTTP(400, `A data da sessão (${fmtBR(dia)}) está fora do período ${nome} (${fmtBR(ini)} a ${fmtBR(fim)}).`);
    }
  }

  // Fim de semana e feriados: fim de semana prevalece (uma só mensagem)
  const bloqueio = motivoDiaBloqueado(dia, configuracao, feriados || []);
  if (bloqueio) {
    throw HTTP(400, bloqueio.mensagem);
  }

  const limite = await prisma.limiteParticipantes.findFirst({ where: { tipo, activo: true } });
  const limiteActivo = Boolean(limite && limite.limite_activo);

  const minimo = limiteActivo ? limite.min : 1;
  const maximo = limiteActivo ? Math.min(lab.capacidade, limite.max) : lab.capacidade;

  // Regra 4: capacidade do laboratório abaixo do mínimo efectivo.
  if (lab.capacidade < minimo) {
    throw HTTP(400, `A capacidade do laboratório "${lab.nome}" (${lab.capacidade}) é inferior ao mínimo configurado para ${tipo} (${minimo})`);
  }
  if (participantes < minimo) {
    throw HTTP(400, `O número de participantes (${participantes}) é inferior ao mínimo permitido para ${tipo} (${minimo})`);
  }
  if (participantes > maximo) {
    if (limiteActivo && limite.max <= lab.capacidade) {
      throw HTTP(400, `O número de participantes (${participantes}) é superior ao máximo configurado para ${tipo} (${limite.max})`);
    }
    throw HTTP(400, `O número de participantes (${participantes}) é superior à capacidade do laboratório "${lab.nome}" (${lab.capacidade})`);
  }
}
