// Seed MySQL — DLab (novo modelo de aprovação por agendamento).
// Uso: node server/scripts/seed-db.js [--force]
//  - --force: apaga e repovoa mesmo que existam dados.
//  - Sem --force: aborta se já existirem utilizadores.
// O stock dos materiais é sempre recalculado a partir do histórico (RF17).
// As senhas ficam vazias; o login atribui o hash de "12345678" no primeiro acesso.

import { prisma } from '../src/db.js';

const force = process.argv.includes('--force');
const D = (s) => new Date(s);

async function run() {
  const existing = await prisma.utilizador.count();
  if (existing > 0 && !force) {
    console.error(`[seed] A base já tem ${existing} utilizadores. Usa --force para repovoar.`);
    process.exit(1);
  }

  // ---- Limpeza (ordem inversa das FKs) ----
  console.log('[seed] a limpar base...');
  await prisma.aprovacao.deleteMany();
  await prisma.historicoMaterial.deleteMany();
  await prisma.actividadeMaterial.deleteMany();
  await prisma.actividadeTecnico.deleteMany();
  await prisma.agendamento.deleteMany();
  await prisma.aula.deleteMany();
  await prisma.visita.deleteMany();
  await prisma.projecto.deleteMany();
  await prisma.estagio.deleteMany();
  await prisma.relatorio.deleteMany();
  await prisma.material.deleteMany();
  await prisma.actividade.deleteMany();
  await prisma.cursoDisciplina.deleteMany();
  await prisma.estudante.deleteMany();
  await prisma.disciplina.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.laboratorio.deleteMany();
  await prisma.utilizador.deleteMany();

  // ---- Utilizadores ----
  console.log('[seed] utilizadores...');
  await prisma.utilizador.createMany({
    data: [
      { id: 1, nome: 'João Silva', email: 'jsilva@isptec.pt', tipo: 'professor', criado_em: D('2025-01-10T10:00:00Z') },
      { id: 2, nome: 'Ana Martins', email: 'amartins@isptec.pt', tipo: 'tecnico', criado_em: D('2025-01-12T10:00:00Z') },
      { id: 3, nome: 'Carlos Pereira', email: 'cpereira@isptec.pt', tipo: 'admin', criado_em: D('2025-01-05T10:00:00Z') },
      { id: 4, nome: 'Maria Santos', email: 'msantos@isptec.pt', tipo: 'coordenador_dlab', criado_em: D('2025-01-08T10:00:00Z') },
      { id: 5, nome: 'Rui Fernandes', email: 'rfernandes@isptec.pt', tipo: 'supervisor', criado_em: D('2025-01-06T10:00:00Z') },
      { id: 6, nome: 'Sofia Costa', email: 'scosta@isptec.pt', tipo: 'chefe_departamento', criado_em: D('2025-01-07T10:00:00Z') },
      { id: 7, nome: 'Pedro Almeida', email: 'palmeida@isptec.pt', tipo: 'professor', criado_em: D('2025-02-01T10:00:00Z') },
    ],
  });

  // ---- Laboratórios ----
  console.log('[seed] laboratorios...');
  await prisma.laboratorio.createMany({
    data: [
      { id: 1, nome: 'Lab. Química 1', tipo: 'quimica', descricao: 'Laboratório de Química Geral e Orgânica', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 2, nome: 'Lab. Física', tipo: 'fisica', descricao: 'Laboratório de Física Aplicada e Mecânica', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 3, nome: 'Lab. Química 2', tipo: 'quimica', descricao: 'Laboratório de Química Analítica', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 4, nome: 'Lab. Multidisciplinar', tipo: 'outro', descricao: 'Laboratório multiuso para projetos e estágios', criado_em: D('2025-01-01T10:00:00Z') },
    ],
  });

  // ---- Académico ----
  console.log('[seed] cursos/disciplinas/cursoDisciplinas/estudantes...');
  await prisma.curso.createMany({
    data: [
      { id: 1, departamento: 'DET', nome: 'Engenharia Informática', abreviacao: 'EI', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 2, departamento: 'DCSA', nome: 'Gestão', abreviacao: 'GES', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 3, departamento: 'DET', nome: 'Engenharia Química', abreviacao: 'EQ', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 4, departamento: 'GEO', nome: 'Geologia', abreviacao: 'GEO', criado_em: D('2025-01-01T10:00:00Z') },
    ],
  });
  await prisma.disciplina.createMany({
    data: [
      { id: 1, nome: 'Química Orgânica I', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 2, nome: 'Física Aplicada', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 3, nome: 'Química Analítica', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 4, nome: 'Programação II', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 5, nome: 'Gestão de Projetos', criado_em: D('2025-01-01T10:00:00Z') },
    ],
  });
  await prisma.cursoDisciplina.createMany({
    data: [
      { id: 1, curso_id: 3, disciplina_id: 1, semestre: 3, criado_em: D('2025-01-01T10:00:00Z') },
      { id: 2, curso_id: 3, disciplina_id: 3, semestre: 4, criado_em: D('2025-01-01T10:00:00Z') },
      { id: 3, curso_id: 1, disciplina_id: 4, semestre: 2, criado_em: D('2025-01-01T10:00:00Z') },
      { id: 4, curso_id: 2, disciplina_id: 5, semestre: 5, criado_em: D('2025-01-01T10:00:00Z') },
    ],
  });
  await prisma.estudante.createMany({
    data: [
      { id: 20210001, nome: 'Carlos Mendes', curso_id: 3, criado_em: D('2021-09-01T10:00:00Z') },
      { id: 20210002, nome: 'Beatriz Lopes', curso_id: 1, criado_em: D('2021-09-01T10:00:00Z') },
      { id: 20210003, nome: 'Diogo Ribeiro', curso_id: 2, criado_em: D('2021-09-01T10:00:00Z') },
      { id: 20220004, nome: 'Inês Tavares', curso_id: 4, criado_em: D('2022-09-01T10:00:00Z') },
      { id: 20220005, nome: 'Mariana Sousa', curso_id: 3, criado_em: D('2022-09-01T10:00:00Z') },
    ],
  });

  // ---- Materiais ----
  console.log('[seed] materiais...');
  await prisma.material.createMany({
    data: [
      { id: 1, laboratorio_id: 1, nome: 'Ácido Clorídrico (HCl)', categoria: 'composto', quantidade: 0, quantidade_minima: 5, unidade: 'ml', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 2, laboratorio_id: 1, nome: 'Béquer 250ml', categoria: 'vidraria', quantidade: 0, quantidade_minima: 10, unidade: 'un', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 3, laboratorio_id: 1, nome: 'Pipeta Graduada', categoria: 'vidraria', quantidade: 0, quantidade_minima: 12, unidade: 'un', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 4, laboratorio_id: 2, nome: 'Multímetro Digital', categoria: 'equipamento', quantidade: 0, quantidade_minima: 5, unidade: 'un', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 5, laboratorio_id: 2, nome: 'Pendulo Simples', categoria: 'equipamento', quantidade: 0, quantidade_minima: 4, unidade: 'un', estado: 'manutencao', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 6, laboratorio_id: 3, nome: 'Sulfato de Cobre', categoria: 'composto', quantidade: 0, quantidade_minima: 3, unidade: 'g', estado: 'esgotado', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 7, laboratorio_id: 3, nome: 'Proveta 100ml', categoria: 'vidraria', quantidade: 0, quantidade_minima: 8, unidade: 'un', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
      { id: 8, laboratorio_id: 1, nome: 'Luvas Nitrilo', categoria: 'consumivel', quantidade: 0, quantidade_minima: 50, unidade: 'un', estado: 'disponivel', criado_em: D('2025-01-01T10:00:00Z') },
    ],
  });

  // ---- Atividades ----
  console.log('[seed] actividades...');
  await prisma.actividade.createMany({
    data: [
      { id: 1, nome: 'Aula Química Orgânica I', criado_por_id: 1, responsavel_id: 1, laboratorio_id: 1, tipo: 'aula', estado: 'revisado_supervisor', num_participantes: 25, precisa_assistente: false, observacoes: 'Aula prática sobre compostos orgânicos', criado_em: D('2026-05-20T10:00:00Z'), actualizado_em: D('2026-05-29T10:00:00Z') },
      { id: 2, nome: 'Visita Institucional - IST', criado_por_id: 4, responsavel_id: 7, laboratorio_id: 2, tipo: 'visita', estado: 'pendente', num_participantes: 15, precisa_assistente: true, observacoes: 'Visita guiada de estudantes do IST', criado_em: D('2026-05-25T10:00:00Z') },
      { id: 3, nome: 'Projeto Síntese Verde', criado_por_id: 7, responsavel_id: 7, laboratorio_id: 3, tipo: 'projecto', estado: 'revisado_dlab', num_participantes: 4, precisa_assistente: true, observacoes: 'Projeto de síntese de compostos verdes', criado_em: D('2026-05-22T10:00:00Z'), actualizado_em: D('2026-05-27T10:00:00Z') },
      { id: 4, nome: 'Estágio - Análise de Águas', criado_por_id: 1, responsavel_id: 1, laboratorio_id: 3, tipo: 'estagio', estado: 'pendente', num_participantes: 1, precisa_assistente: false, observacoes: 'Estágio de análise de águas residuais', criado_em: D('2026-05-28T10:00:00Z') },
      { id: 5, nome: 'Aula Física Aplicada', criado_por_id: 1, responsavel_id: 1, laboratorio_id: 2, tipo: 'aula', estado: 'revisado_dlab', num_participantes: 20, precisa_assistente: false, observacoes: 'Aula sobre movimento oscilatório', criado_em: D('2026-05-15T10:00:00Z'), actualizado_em: D('2026-05-26T10:00:00Z') },
      { id: 6, nome: 'Aula Química Analítica', criado_por_id: 7, responsavel_id: 7, laboratorio_id: 3, tipo: 'aula', estado: 'rejeitado', num_participantes: 18, precisa_assistente: false, observacoes: 'Aula sobre titulações', criado_em: D('2026-05-10T10:00:00Z'), actualizado_em: D('2026-05-20T10:00:00Z') },
    ],
  });

  // ---- Especializações ----
  console.log('[seed] especializacoes...');
  await prisma.aula.createMany({
    data: [
      { id: 1, actividade_id: 1, curso_disciplina_id: 1, tema: 'Compostos Aromáticos', turno: 'manha', numero_turma: 1, criado_em: D('2026-05-20T10:00:00Z') },
      { id: 2, actividade_id: 5, curso_disciplina_id: 2, tema: 'Pêndulo Simples', turno: 'tarde', numero_turma: 2, criado_em: D('2026-05-15T10:00:00Z') },
      { id: 3, actividade_id: 6, curso_disciplina_id: 3, tema: 'Titulações Ácido-Base', turno: 'manha', numero_turma: 3, criado_em: D('2026-05-10T10:00:00Z') },
    ],
  });
  await prisma.visita.createMany({
    data: [
      { id: 1, actividade_id: 2, nome_visitante: 'Prof. Ricardo Gomes', instituicao: 'Instituto Superior Técnico', telefone: '+351 210 000 000', email: 'rgomes@ist.pt', criado_em: D('2026-05-25T10:00:00Z') },
    ],
  });
  await prisma.projecto.createMany({
    data: [
      { id: 1, actividade_id: 3, titulo: 'Síntese de Compostos Verdes', descricao: 'Desenvolvimento de métodos de síntese sustentável', data_inicio: D('2026-06-01T00:00:00Z'), data_fim: D('2026-12-31T00:00:00Z'), criado_em: D('2026-05-22T10:00:00Z') },
    ],
  });
  await prisma.estagio.createMany({
    data: [
      { id: 1, actividade_id: 4, estudante_id: 20210001, data_inicio: D('2026-07-01T00:00:00Z'), data_fim: D('2026-12-31T00:00:00Z'), criado_em: D('2026-05-28T10:00:00Z') },
    ],
  });

  // ---- Agendamentos (votação individual por agendamento) ----
  console.log('[seed] agendamentos...');
  await prisma.agendamento.createMany({
    data: [
      { id: 1, actividade_id: 1, hora_inicio: D('2026-06-01T09:00:00Z'), hora_fim: D('2026-06-01T12:00:00Z'), estado: 'aprovado_supervisor', confirmado_professor_em: D('2026-06-01T12:30:00Z'), confirmado_tecnico_em: D('2026-06-01T13:00:00Z'), realizado: true, criado_em: D('2026-05-20T10:00:00Z'), actualizado_em: D('2026-06-01T13:00:00Z') },
      { id: 2, actividade_id: 1, hora_inicio: D('2026-06-08T09:00:00Z'), hora_fim: D('2026-06-08T12:00:00Z'), estado: 'aprovado_supervisor', criado_em: D('2026-05-20T10:00:00Z') },
      { id: 3, actividade_id: 1, hora_inicio: D('2026-06-15T09:00:00Z'), hora_fim: D('2026-06-15T12:00:00Z'), estado: 'aprovado_supervisor', criado_em: D('2026-05-20T10:00:00Z') },
      { id: 4, actividade_id: 3, hora_inicio: D('2026-06-10T10:00:00Z'), hora_fim: D('2026-06-10T13:00:00Z'), estado: 'aprovado_dlab', criado_em: D('2026-05-22T10:00:00Z') },
      { id: 5, actividade_id: 3, hora_inicio: D('2026-06-17T10:00:00Z'), hora_fim: D('2026-06-17T13:00:00Z'), estado: 'aprovado_dlab', criado_em: D('2026-05-22T10:00:00Z') },
      { id: 6, actividade_id: 5, hora_inicio: D('2026-06-03T14:00:00Z'), hora_fim: D('2026-06-03T17:00:00Z'), estado: 'aprovado_dlab', criado_em: D('2026-05-15T10:00:00Z') },
      { id: 7, actividade_id: 2, hora_inicio: D('2026-06-20T14:00:00Z'), hora_fim: D('2026-06-20T16:00:00Z'), estado: 'nao_revisto', criado_em: D('2026-05-25T10:00:00Z') },
      { id: 8, actividade_id: 4, hora_inicio: D('2026-07-01T09:00:00Z'), hora_fim: D('2026-07-01T13:00:00Z'), estado: 'nao_revisto', criado_em: D('2026-05-28T10:00:00Z') },
      { id: 9, actividade_id: 6, hora_inicio: D('2026-05-30T09:00:00Z'), hora_fim: D('2026-05-30T12:00:00Z'), estado: 'rejeitado', criado_em: D('2026-05-10T10:00:00Z'), actualizado_em: D('2026-05-20T10:00:00Z') },
    ],
  });

  // ---- Aprovações (ligadas ao agendamento) ----
  console.log('[seed] aprovacoes...');
  await prisma.aprovacao.createMany({
    data: [
      { id: 1, agendamento_id: 1, actividade_id: 1, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Proposta adequada, laboratório disponível.', decidido_em: D('2026-05-28T10:00:00Z') },
      { id: 2, agendamento_id: 1, actividade_id: 1, aprovador_id: 5, etapa: 'supervisor', decisao: 'aprovado', comentario: 'Aprovado. Técnico atribuído.', decidido_em: D('2026-05-29T10:00:00Z') },
      { id: 3, agendamento_id: 2, actividade_id: 1, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Sem problemas.', decidido_em: D('2026-05-28T10:00:00Z') },
      { id: 4, agendamento_id: 2, actividade_id: 1, aprovador_id: 5, etapa: 'supervisor', decisao: 'aprovado', comentario: 'Aprovado.', decidido_em: D('2026-05-29T10:00:00Z') },
      { id: 5, agendamento_id: 3, actividade_id: 1, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Sem problemas.', decidido_em: D('2026-05-28T10:00:00Z') },
      { id: 6, agendamento_id: 3, actividade_id: 1, aprovador_id: 5, etapa: 'supervisor', decisao: 'aprovado', comentario: 'Aprovado.', decidido_em: D('2026-05-29T10:00:00Z') },
      { id: 7, agendamento_id: 4, actividade_id: 3, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Horário disponível.', decidido_em: D('2026-05-26T10:00:00Z') },
      { id: 8, agendamento_id: 5, actividade_id: 3, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Horário disponível.', decidido_em: D('2026-05-26T10:00:00Z') },
      { id: 9, agendamento_id: 6, actividade_id: 5, aprovador_id: 4, etapa: 'dlab', decisao: 'aprovado', comentario: 'Sem problemas.', decidido_em: D('2026-05-26T10:00:00Z') },
      { id: 10, agendamento_id: null, actividade_id: 6, aprovador_id: 4, etapa: 'dlab', decisao: 'rejeitado', comentario: 'Choque de horário com outra atividade já aprovada.', decidido_em: D('2026-05-20T10:00:00Z') },
    ],
  });

  // ---- Técnicos / Materiais da atividade ----
  console.log('[seed] atividadeTecnicos / atividadeMateriais...');
  await prisma.actividadeTecnico.createMany({
    data: [
      { id: 1, actividade_id: 1, utilizador_id: 2, papel: 'validador', criado_em: D('2026-05-29T10:00:00Z') },
    ],
  });
  await prisma.actividadeMaterial.createMany({
    data: [
      { id: 1, actividade_id: 1, material_id: 1, quantidade_estimada: 200, criado_em: D('2026-05-20T10:00:00Z') },
      { id: 2, actividade_id: 1, material_id: 2, quantidade_estimada: 10, criado_em: D('2026-05-20T10:00:00Z') },
    ],
  });

  // ---- Histórico de materiais ----
  console.log('[seed] historico...');
  await prisma.historicoMaterial.createMany({
    data: [
      { id: 1, material_id: 1, utilizador_id: 2, quantidade_movimentada: 100, motivo: 'compra_stock', descricao: 'Compra inicial de stock', criado_em: D('2025-01-15T10:00:00Z') },
      { id: 2, material_id: 1, utilizador_id: 2, actividade_id: 1, quantidade_movimentada: -3, motivo: 'consumo_actividade', descricao: 'Consumo em aula prática', criado_em: D('2026-06-01T10:00:00Z') },
      { id: 3, material_id: 1, utilizador_id: 2, quantidade_movimentada: -95, motivo: 'quebra_acidente', descricao: 'Derrame acidental de frasco', criado_em: D('2026-06-10T10:00:00Z') },
      { id: 4, material_id: 2, utilizador_id: 2, quantidade_movimentada: 50, motivo: 'compra_stock', descricao: 'Compra inicial', criado_em: D('2025-01-15T10:00:00Z') },
      { id: 5, material_id: 2, utilizador_id: 2, actividade_id: 1, quantidade_movimentada: -10, motivo: 'consumo_actividade', descricao: 'Quebra de 10 béqueres em aula', criado_em: D('2026-06-01T10:00:00Z') },
    ],
  });

  // ---- Relatórios ----
  console.log('[seed] relatorios...');
  await prisma.relatorio.createMany({
    data: [
      { id: 1, laboratorio_id: 1, criado_por: 2, mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 14, total_realizadas: 12, total_materiais_baixados: 8, por_tipo: [{ tipo: 'aula', count: 8 }, { tipo: 'visita', count: 2 }, { tipo: 'projecto', count: 3 }, { tipo: 'estagio', count: 1 }], por_lab: [{ lab: 'Lab. Química 1', count: 14 }] }), criado_em: D('2026-07-01T10:00:00Z') },
      { id: 2, laboratorio_id: 2, criado_por: 3, mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 8, total_realizadas: 6, total_materiais_baixados: 3, por_tipo: [{ tipo: 'aula', count: 5 }, { tipo: 'visita', count: 3 }], por_lab: [{ lab: 'Lab. Física', count: 8 }] }), criado_em: D('2026-07-01T10:00:00Z') },
    ],
  });

  // ---- RF17: stock desnormalizado recalculado do histórico ----
  console.log('[seed] recalcular stock (RF17)...');
  const mats = await prisma.material.findMany({ select: { id: true } });
  for (const m of mats) {
    const agg = await prisma.historicoMaterial.aggregate({
      _sum: { quantidade_movimentada: true },
      where: { material_id: m.id, activo: true },
    });
    await prisma.material.update({
      where: { id: m.id },
      data: { quantidade: agg._sum.quantidade_movimentada ?? 0 },
    });
  }

  await prisma.$disconnect();
  console.log('\n[seed] concluído. + 7 utilizadores · 6 actividades · 9 agendamentos · 10 aprovações · 8 materiais');
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[seed] erro:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});