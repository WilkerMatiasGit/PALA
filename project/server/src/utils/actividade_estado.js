// Derivação do estado de uma ACTIVIDADE a partir do conjunto dos seus agendamentos.
// Chama-se sempre que o estado/realizado de um agendamento muda (aprovação,
// rejeição, "deixar pendente", confirmação técnica/realização) — sempre dentro
// da própria transação (tx) para que o cálculo nunca fique inconsistente.
//
// Regras (PLANO.md §0.1 / AGENTS.md RF):
//   pendente      → sem nenhuma DecisaoAgendamento na atividade;
//   em_andamento  → pelo menos uma decisão e ainda não encerrado (regras abaixo);
//   rejeitada     → TODOS os agendamentos com estado 'rejeitado';
//   realizada     → TODOS os agendamentos (realizado = true OU estado = 'rejeitado')
//                   E existe ≥1 agendamento com realizado = true.
//     (os dois cálculos nunca colidem: rejeitada não tem realizado; realizada é
//      tentada primeiro na deteção de "todos encerrados").
export async function recalcularEstadoActividade(tx, atividadeId) {
  const ags = await tx.agendamento.findMany({
    where: { activo: true, actividade_id: atividadeId },
    select: { estado: true, realizado: true, decisoes: { select: { id: true } } },
  });

  if (ags.length === 0) {
    // Sem sessões ativas mantém o estado atual (evita "falar" do que já não existe).
    return tx.actividade.findUnique({ where: { id: atividadeId } }).then((a) => a?.estado);
  }

  const temDecisao = ags.some((g) => g.decisoes.length > 0);
  const todosRejeitados = ags.every((g) => g.estado === 'rejeitado');
  const todosEncerrados =
    ags.every((g) => g.realizado || g.estado === 'rejeitado') && ags.some((g) => g.realizado);

  let estado;
  if (!temDecisao) {
    estado = 'pendente';
  } else if (todosRejeitados) {
    estado = 'rejeitada';
  } else if (todosEncerrados) {
    estado = 'realizada';
  } else {
    estado = 'em_andamento';
  }

  await tx.actividade.update({ where: { id: atividadeId }, data: { estado } });
  return estado;
}