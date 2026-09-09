// Seed inicial — espelho exato de src/services/mockData.ts (contract DTOs já resolvidos).
// A senha de seed é a mesma para todos os utilizadores (dev/test). Em produção trocar por
// password hashing real + gestão de credenciais. senha_hash preenchido no primeiro arranque.

export function buildSeed() {
  const now = new Date().toISOString();
  return {
    utilizadores: [
      { id: 1, nome: 'João Silva', email: 'jsilva@isptec.pt', tipo: 'professor', criado_em: '2025-01-10T10:00:00Z', actualizado_em: '2025-01-10T10:00:00Z' },
      { id: 2, nome: 'Ana Martins', email: 'amartins@isptec.pt', tipo: 'tecnico', criado_em: '2025-01-12T10:00:00Z', actualizado_em: '2025-01-12T10:00:00Z' },
      { id: 3, nome: 'Carlos Pereira', email: 'cpereira@isptec.pt', tipo: 'admin', criado_em: '2025-01-05T10:00:00Z', actualizado_em: '2025-01-05T10:00:00Z' },
      { id: 4, nome: 'Maria Santos', email: 'msantos@isptec.pt', tipo: 'coordenador_dlab', criado_em: '2025-01-08T10:00:00Z', actualizado_em: '2025-01-08T10:00:00Z' },
      { id: 5, nome: 'Rui Fernandes', email: 'rfernandes@isptec.pt', tipo: 'supervisor', criado_em: '2025-01-06T10:00:00Z', actualizado_em: '2025-01-06T10:00:00Z' },
      { id: 6, nome: 'Sofia Costa', email: 'scosta@isptec.pt', tipo: 'chefe_departamento', criado_em: '2025-01-07T10:00:00Z', actualizado_em: '2025-01-07T10:00:00Z' },
      { id: 7, nome: 'Pedro Almeida', email: 'palmeida@isptec.pt', tipo: 'professor', criado_em: '2025-02-01T10:00:00Z', actualizado_em: '2025-02-01T10:00:00Z' },
    ],
    laboratorios: [
      { id: 1, nome: 'Lab. Química 1', tipo: 'quimica', descricao: 'Laboratório de Química Geral e Orgânica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 2, nome: 'Lab. Física', tipo: 'fisica', descricao: 'Laboratório de Física Aplicada e Mecânica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 3, nome: 'Lab. Química 2', tipo: 'quimica', descricao: 'Laboratório de Química Analítica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 4, nome: 'Lab. Multidisciplinar', tipo: 'outro', descricao: 'Laboratório multiuso para projetos e estágios', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
    ],
    cursos: [
      { id: 1, departamento: 'DET', nome: 'Engenharia Informática', abreviacao: 'EI', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 2, departamento: 'DCSA', nome: 'Gestão', abreviacao: 'GES', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 3, departamento: 'DET', nome: 'Engenharia Química', abreviacao: 'EQ', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 4, departamento: 'GEO', nome: 'Geologia', abreviacao: 'GEO', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
    ],
    disciplinas: [
      { id: 1, nome: 'Química Orgânica I', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 2, nome: 'Física Aplicada', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 3, nome: 'Química Analítica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 4, nome: 'Programação II', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 5, nome: 'Gestão de Projetos', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
    ],
    cursoDisciplinas: [
      { id: 1, curso_id: 3, curso_nome: 'Engenharia Química', disciplina_id: 1, disciplina_nome: 'Química Orgânica I', semestre: 3, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 2, curso_id: 3, curso_nome: 'Engenharia Química', disciplina_id: 3, disciplina_nome: 'Química Analítica', semestre: 4, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 3, curso_id: 1, curso_nome: 'Engenharia Informática', disciplina_id: 4, disciplina_nome: 'Programação II', semestre: 2, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 4, curso_id: 2, curso_nome: 'Gestão', disciplina_id: 5, disciplina_nome: 'Gestão de Projetos', semestre: 5, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
    ],
    estudantes: [
      { id: 20210001, nome: 'Carlos Mendes', curso_id: 3, curso_nome: 'Engenharia Química', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
      { id: 20210002, nome: 'Beatriz Lopes', curso_id: 1, curso_nome: 'Engenharia Informática', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
      { id: 20210003, nome: 'Diogo Ribeiro', curso_id: 2, curso_nome: 'Gestão', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
      { id: 20220004, nome: 'Inês Tavares', curso_id: 4, curso_nome: 'Geologia', criado_em: '2022-09-01T10:00:00Z', actualizado_em: '2022-09-01T10:00:00Z' },
      { id: 20220005, nome: 'Mariana Sousa', curso_id: 3, curso_nome: 'Engenharia Química', criado_em: '2022-09-01T10:00:00Z', actualizado_em: '2022-09-01T10:00:00Z' },
    ],
    materiais: [
      { id: 1, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Ácido Clorídrico (HCl)', categoria: 'composto', quantidade: 2, quantidade_minima: 5, unidade: 'ml', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
      { id: 2, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Béquer 250ml', categoria: 'vidraria', quantidade: 40, quantidade_minima: 10, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 3, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Pipeta Graduada', categoria: 'vidraria', quantidade: 8, quantidade_minima: 12, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 4, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', nome: 'Multímetro Digital', categoria: 'equipamento', quantidade: 15, quantidade_minima: 5, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 5, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', nome: 'Pendulo Simples', categoria: 'equipamento', quantidade: 3, quantidade_minima: 4, unidade: 'un', estado: 'manutencao', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 6, laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', nome: 'Sulfato de Cobre', categoria: 'composto', quantidade: 0, quantidade_minima: 3, unidade: 'g', estado: 'esgotado', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 7, laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', nome: 'Proveta 100ml', categoria: 'vidraria', quantidade: 25, quantidade_minima: 8, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
      { id: 8, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Luvas Nitrilo', categoria: 'consumivel', quantidade: 200, quantidade_minima: 50, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
    ],
    historico: [
      { id: 1, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: 100, motivo: 'compra_stock', descricao: 'Compra inicial de stock', criado_em: '2025-01-15T10:00:00Z', actualizado_em: '2025-01-15T10:00:00Z' },
      { id: 2, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', actividade_id: 1, actividade_nome: 'Aula Química Orgânica', quantidade_movimentada: -3, motivo: 'consumo_actividade', descricao: 'Consumo em aula prática', criado_em: '2026-06-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
      { id: 3, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: -95, motivo: 'quebra_acidente', descricao: 'Derrame acidental de frasco', criado_em: '2026-06-10T10:00:00Z', actualizado_em: '2026-06-10T10:00:00Z' },
      { id: 4, material_id: 2, material_nome: 'Béquer 250ml', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: 50, motivo: 'compra_stock', descricao: 'Compra inicial', criado_em: '2025-01-15T10:00:00Z', actualizado_em: '2025-01-15T10:00:00Z' },
      { id: 5, material_id: 2, material_nome: 'Béquer 250ml', utilizador_id: 2, utilizador_nome: 'Ana Martins', actividade_id: 1, actividade_nome: 'Aula Química Orgânica', quantidade_movimentada: -10, motivo: 'consumo_actividade', descricao: 'Quebra de 10 béqueres em aula', criado_em: '2026-06-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
    ],
    actividades: [
      { id: 1, nome: 'Aula Química Orgânica I', utilizador_id: 1, utilizador_nome: 'João Silva', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', tipo: 'aula', estado: 'aprovado_supervisor', num_participantes: 25, precisa_assistente: false, observacoes: 'Aula prática sobre compostos orgânicos', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
      { id: 2, nome: 'Visita Institucional - IST', utilizador_id: 4, utilizador_nome: 'Maria Santos', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', tipo: 'visita', estado: 'pendente', num_participantes: 15, precisa_assistente: true, observacoes: 'Visita guiada de estudantes do IST', criado_em: '2026-05-25T10:00:00Z', actualizado_em: '2026-05-25T10:00:00Z' },
      { id: 3, nome: 'Projeto Síntese Verde', utilizador_id: 7, utilizador_nome: 'Pedro Almeida', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'projecto', estado: 'aprovado_dlab', num_participantes: 4, precisa_assistente: true, observacoes: 'Projeto de síntese de compostos verdes', criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-27T10:00:00Z' },
      { id: 4, nome: 'Estágio - Análise de Águas', utilizador_id: 1, utilizador_nome: 'João Silva', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'estagio', estado: 'pendente', num_participantes: 1, precisa_assistente: false, observacoes: 'Estágio de análise de águas residuais', criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
      { id: 5, nome: 'Aula Física Aplicada', utilizador_id: 1, utilizador_nome: 'João Silva', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', tipo: 'aula', estado: 'aprovado_dlab', num_participantes: 20, precisa_assistente: false, observacoes: 'Aula sobre movimento oscilatório', criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-26T10:00:00Z' },
      { id: 6, nome: 'Aula Química Analítica', utilizador_id: 7, utilizador_nome: 'Pedro Almeida', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'aula', estado: 'rejeitado', num_participantes: 18, precisa_assistente: false, observacoes: 'Aula sobre titulações', criado_em: '2026-05-10T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
    ],
    aulas: [
      { id: 1, actividade_id: 1, curso_disciplina_id: 1, curso_disciplina_nome: 'Química Orgânica I (EQ - 3º Sem)', tema: 'Compostos Aromáticos', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
      { id: 2, actividade_id: 5, curso_disciplina_id: 2, curso_disciplina_nome: 'Física Aplicada (EQ - 4º Sem)', tema: 'Pêndulo Simples', criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-15T10:00:00Z' },
    ],
    visitas: [
      { id: 1, actividade_id: 2, nome_visitante: 'Prof. Ricardo Gomes', instituicao: 'Instituto Superior Técnico', telefone: '+351 210 000 000', email: 'rgomes@ist.pt', criado_em: '2026-05-25T10:00:00Z', actualizado_em: '2026-05-25T10:00:00Z' },
    ],
    projectos: [
      { id: 1, actividade_id: 3, responsavel_id: 7, responsavel_nome: 'Pedro Almeida', titulo: 'Síntese de Compostos Verdes', descricao: 'Desenvolvimento de métodos de síntese sustentável', data_inicio: '2026-06-01', data_fim: '2026-12-31', anexo_path: undefined, criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
    ],
    estagios: [
      { id: 1, actividade_id: 4, responsavel_id: 1, responsavel_nome: 'João Silva', estudante_id: 20210001, estudante_nome: 'Carlos Mendes', data_inicio: '2026-07-01', data_fim: '2026-12-31', anexo_path: undefined, criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
    ],
    agendamentos: [
      { id: 1, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-01T09:00:00Z', hora_fim: '2026-06-01T12:00:00Z', confirmado_professor_em: '2026-06-01T12:30:00Z', confirmado_tecnico_em: '2026-06-01T13:00:00Z', realizado: true, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-06-01T13:00:00Z' },
      { id: 2, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-08T09:00:00Z', hora_fim: '2026-06-08T12:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
      { id: 3, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-15T09:00:00Z', hora_fim: '2026-06-15T12:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
      { id: 4, actividade_id: 5, actividade_nome: 'Aula Física Aplicada', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', hora_inicio: '2026-06-03T14:00:00Z', hora_fim: '2026-06-03T17:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-15T10:00:00Z' },
      { id: 5, actividade_id: 3, actividade_nome: 'Projeto Síntese Verde', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', hora_inicio: '2026-06-10T10:00:00Z', hora_fim: '2026-06-10T13:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
      { id: 6, actividade_id: 3, actividade_nome: 'Projeto Síntese Verde', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', hora_inicio: '2026-06-10T10:00:00Z', hora_fim: '2026-06-10T13:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
    ],
    aprovacoes: [
      { id: 1, actividade_id: 1, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'aprovado', comentario: 'Proposta adequada, laboratório disponível.', decidido_em: '2026-05-28T10:00:00Z', criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
      { id: 2, actividade_id: 1, aprovador_id: 5, aprovador_nome: 'Rui Fernandes', etapa: 'supervisor', decisao: 'aprovado', comentario: 'Aprovado. Técnico atribuído.', decidido_em: '2026-05-29T10:00:00Z', criado_em: '2026-05-29T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
      { id: 3, actividade_id: 5, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'aprovado', comentario: 'Sem problemas.', decidido_em: '2026-05-26T10:00:00Z', criado_em: '2026-05-26T10:00:00Z', actualizado_em: '2026-05-26T10:00:00Z' },
      { id: 4, actividade_id: 6, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'rejeitado', comentario: 'Choque de horário com outra atividade já aprovada.', decidido_em: '2026-05-20T10:00:00Z', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
    ],
    actividadeTecnicos: [
      { id: 1, actividade_id: 1, utilizador_id: 2, utilizador_nome: 'Ana Martins', papel: 'validador', criado_em: '2026-05-29T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
    ],
    actividadeMateriais: [
      { id: 1, actividade_id: 1, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', quantidade_estimada: 200, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
      { id: 2, actividade_id: 1, material_id: 2, material_nome: 'Béquer 250ml', quantidade_estimada: 10, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
    ],
    relatorios: [
      { id: 1, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', criado_por: 2, criado_por_nome: 'Ana Martins', mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 14, total_realizadas: 12, total_materiais_baixados: 8, por_tipo: [{ tipo: 'aula', count: 8 }, { tipo: 'visita', count: 2 }, { tipo: 'projecto', count: 3 }, { tipo: 'estagio', count: 1 }], por_lab: [{ lab: 'Lab. Química 1', count: 14 }] }), criado_em: '2026-07-01T10:00:00Z', actualizado_em: '2026-07-01T10:00:00Z' },
      { id: 2, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', criado_por: 3, criado_por_nome: 'Carlos Pereira', mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 8, total_realizadas: 6, total_materiais_baixados: 3, por_tipo: [{ tipo: 'aula', count: 5 }, { tipo: 'visita', count: 3 }], por_lab: [{ lab: 'Lab. Física', count: 8 }] }), criado_em: '2026-07-01T10:00:00Z', actualizado_em: '2026-07-01T10:00:00Z' },
    ],
    nextId: 1000,
    meta: { seedVersion: 1, createdAt: now },
  };
}
