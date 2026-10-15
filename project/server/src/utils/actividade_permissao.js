import { prisma } from '../db.js';

// Erro com código HTTP (mesma convenção usada nas rotas de atividades).
export const HTTP = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

export const MSG_NAO_AUTORIZADO =
  'Apenas o responsável pela atividade ou um administrador a podem alterar ou apagar.';
export const MSG_COM_DECISOES =
  'Esta atividade já tem sessões revistas e não pode ser alterada. Rejeita-a ou cria uma nova.';
export const MSG_REJEITADA = 'Uma atividade rejeitada não pode ser alterada nem apagada.';
export const MSG_ULTIMA_SESSAO =
  'Uma atividade precisa de pelo menos uma sessão. Para remover tudo, apaga a atividade.';

// Regras 1 (estado) + 2 (autoria) para editar/apagar uma atividade e as suas sessões.
// Avaliação pura (sem acesso à BD): recebe `temDecisoes` (existe alguma sessão ACTIVA
// da atividade com pelo menos uma decisão registada?).
// Devolve { ok: true } ou { ok: false, status, motivo }.
export function avaliarAlteracaoActividade(actividade, utilizador, temDecisoes) {
  if (!actividade) return { ok: false, status: 404, motivo: 'Atividade não encontrada' };

  // Regra 2: só o responsável pela atividade ou um Admin.
  const ehAdmin = utilizador?.tipo === 'admin';
  const ehResponsavel = Boolean(utilizador) && utilizador.id === actividade.responsavel_id;
  if (!ehAdmin && !ehResponsavel) {
    return { ok: false, status: 403, motivo: MSG_NAO_AUTORIZADO };
  }

  // Regra 1a: uma atividade rejeitada nunca é editável nem apagável.
  if (actividade.estado === 'rejeitada') {
    return { ok: false, status: 409, motivo: MSG_REJEITADA };
  }

  // Regra 1b: nenhuma sessão ACTIVA pode ter decisão registada.
  if (temDecisoes) {
    return { ok: false, status: 409, motivo: MSG_COM_DECISOES };
  }

  return { ok: true };
}

// Versão assíncrona: consulta as decisões no `client` indicado (permite passar um
// cliente de transação). Aceita `actividade.tem_decisoes` pré-calculado (usado nas
// listagens, para evitar N consultas).
export async function podeAlterarActividade(actividade, utilizador, client = prisma) {
  let temDecisoes = actividade?.tem_decisoes;
  if (temDecisoes === undefined && actividade?.id != null) {
    const n = await client.agendamento.count({
      where: { actividade_id: actividade.id, activo: true, decisoes: { some: {} } },
    });
    temDecisoes = n > 0;
  }
  return avaliarAlteracaoActividade(actividade, utilizador, Boolean(temDecisoes));
}

// Executa `fn(tx)` numa transação, revalidando as regras 1+2 no seu início (leitura e
// gravação ficam atómicas). Lança o erro HTTP da regra violada.
export async function alterarComPermissao(actividade, utilizador, fn) {
  return prisma.$transaction(async (tx) => {
    const perm = await podeAlterarActividade(actividade, utilizador, tx);
    if (!perm.ok) throw HTTP(perm.status, perm.motivo);
    return fn(tx);
  });
}

// Flags para o front (GET da atividade): booleanos, como `pode_rejeitar_atividade`.
export function flagsActividade(actividade, utilizador, temDecisoes) {
  const perm = avaliarAlteracaoActividade(actividade, utilizador, temDecisoes);
  return { pode_editar: perm.ok, pode_apagar: perm.ok };
}
