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
//  - período: quando `periodo` é indicado (projeto/estágio), a data da sessão tem
//    de estar dentro de [inicio, fim], inclusive. Aula e visita não têm período.
//
// `periodo` (opcional): { inicio, fim } em 'YYYY-MM-DD' ou Date.
//
// Recebe o objecto completo da sessão (não só o nº de participantes) para que os
// próximos pedidos possam acrescentar validações de fim de semana/feriados (a partir
// de `hora_inicio`/`hora_fim`) sem alterar os chamadores.
export async function validarSessao(sessao, periodo) {
  const { tipo, laboratorio_id, num_participantes } = sessao || {};

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
