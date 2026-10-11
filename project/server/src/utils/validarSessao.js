import { prisma } from '../db.js';

// Erro com código HTTP (mesma convenção usada nas rotas de atividades).
const HTTP = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

// Validação de uma SESSÃO (agendamento) na criação/solicitação.
//
// Regras atuais (participantes):
//  1. capacidade do laboratório: num_participantes <= laboratorio.capacidade;
//  2. quando o limite do tipo está activo (limite_activo): min <= num_participantes <= max;
//  3. mínimo efectivo = min do tipo (se activo), senão 1;
//     máximo efectivo  = min(capacidade do lab, max do tipo) se activo, senão capacidade;
//  4. se a capacidade do lab < mínimo efectivo, nenhuma sessão é possível (mensagem específica).
//
// Recebe o objecto completo da sessão (não só o nº de participantes) para que os
// próximos pedidos possam acrescentar validações de fim de semana/feriados (a partir
// de `hora_inicio`/`hora_fim`) sem alterar os chamadores.
export async function validarSessao(sessao) {
  const { tipo, laboratorio_id, num_participantes } = sessao || {};

  const lab = await prisma.laboratorio.findUnique({ where: { id: Number(laboratorio_id) } });
  if (!lab || !lab.activo) throw HTTP(404, 'Laboratório não encontrado');

  const participantes = Number(num_participantes);
  if (!Number.isInteger(participantes) || participantes < 1) {
    throw HTTP(400, 'O número de participantes de cada sessão deve ser um inteiro maior que zero');
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
