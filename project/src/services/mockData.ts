import type { UtilizadorGet } from '@/types/utilizador.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import type { CursoGet } from '@/types/curso.types';
import type { DisciplinaGet, CursoDisciplinaGet } from '@/types/disciplina.types';
import type { EstudanteGet } from '@/types/estudantes.types';
import type { ActividadeGet, AulaGet, VisitaGet, ProjectoGet, EstagioGet, ActividadeTecnicoGet, ActividadeMaterialGet } from '@/types/actividade.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { AprovacaoGet } from '@/types/aprovacao.types';
import type { MaterialGet, HistoricoMaterialGet } from '@/types/material.types';
import type { RelatorioGet } from '@/types/relatorio.types';

export const mockUtilizadores: UtilizadorGet[] = [
  { id: 1, nome: 'João Silva', email: 'jsilva@isptec.pt', tipo: 'professor', criado_em: '2025-01-10T10:00:00Z', actualizado_em: '2025-01-10T10:00:00Z' },
  { id: 2, nome: 'Ana Martins', email: 'amartins@isptec.pt', tipo: 'tecnico', criado_em: '2025-01-12T10:00:00Z', actualizado_em: '2025-01-12T10:00:00Z' },
  { id: 3, nome: 'Carlos Pereira', email: 'cpereira@isptec.pt', tipo: 'admin', criado_em: '2025-01-05T10:00:00Z', actualizado_em: '2025-01-05T10:00:00Z' },
  { id: 4, nome: 'Maria Santos', email: 'msantos@isptec.pt', tipo: 'coordenador_dlab', criado_em: '2025-01-08T10:00:00Z', actualizado_em: '2025-01-08T10:00:00Z' },
  { id: 5, nome: 'Rui Fernandes', email: 'rfernandes@isptec.pt', tipo: 'supervisor', criado_em: '2025-01-06T10:00:00Z', actualizado_em: '2025-01-06T10:00:00Z' },
  { id: 6, nome: 'Sofia Costa', email: 'scosta@isptec.pt', tipo: 'chefe_departamento', criado_em: '2025-01-07T10:00:00Z', actualizado_em: '2025-01-07T10:00:00Z' },
  { id: 7, nome: 'Pedro Almeida', email: 'palmeida@isptec.pt', tipo: 'professor', criado_em: '2025-02-01T10:00:00Z', actualizado_em: '2025-02-01T10:00:00Z' },
];

export const mockLaboratorios: LaboratorioGet[] = [
  { id: 1, nome: 'Lab. Química 1', tipo: 'quimica', descricao: 'Laboratório de Química Geral e Orgânica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 2, nome: 'Lab. Física', tipo: 'fisica', descricao: 'Laboratório de Física Aplicada e Mecânica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 3, nome: 'Lab. Química 2', tipo: 'quimica', descricao: 'Laboratório de Química Analítica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 4, nome: 'Lab. Multidisciplinar', tipo: 'outro', descricao: 'Laboratório multiuso para projetos e estágios', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
];

export const mockCursos: CursoGet[] = [
  { id: 1, departamento: 'DET', nome: 'Engenharia Informática', abreviacao: 'EI', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 2, departamento: 'DCSA', nome: 'Gestão', abreviacao: 'GES', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 3, departamento: 'DET', nome: 'Engenharia Química', abreviacao: 'EQ', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 4, departamento: 'GEO', nome: 'Geologia', abreviacao: 'GEO', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
];

export const mockDisciplinas: DisciplinaGet[] = [
  { id: 1, nome: 'Química Orgânica I', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 2, nome: 'Física Aplicada', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 3, nome: 'Química Analítica', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 4, nome: 'Programação II', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 5, nome: 'Gestão de Projetos', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
];

export const mockCursoDisciplinas: CursoDisciplinaGet[] = [
  { id: 1, curso_id: 3, curso_nome: 'Engenharia Química', curso_abreviacao: 'EQ', disciplina_id: 1, disciplina_nome: 'Química Orgânica I', semestre: 3, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 2, curso_id: 3, curso_nome: 'Engenharia Química', curso_abreviacao: 'EQ', disciplina_id: 3, disciplina_nome: 'Química Analítica', semestre: 4, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 3, curso_id: 1, curso_nome: 'Engenharia Informática', curso_abreviacao: 'EI', disciplina_id: 4, disciplina_nome: 'Programação II', semestre: 2, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 4, curso_id: 2, curso_nome: 'Gestão', curso_abreviacao: 'GES', disciplina_id: 5, disciplina_nome: 'Gestão de Projetos', semestre: 5, criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
];

export const mockEstudantes: EstudanteGet[] = [
  { id: 20210001, nome: 'Carlos Mendes', curso_id: 3, curso_nome: 'Engenharia Química', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
  { id: 20210002, nome: 'Beatriz Lopes', curso_id: 1, curso_nome: 'Engenharia Informática', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
  { id: 20210003, nome: 'Diogo Ribeiro', curso_id: 2, curso_nome: 'Gestão', criado_em: '2021-09-01T10:00:00Z', actualizado_em: '2021-09-01T10:00:00Z' },
  { id: 20220004, nome: 'Inês Tavares', curso_id: 4, curso_nome: 'Geologia', criado_em: '2022-09-01T10:00:00Z', actualizado_em: '2022-09-01T10:00:00Z' },
  { id: 20220005, nome: 'Mariana Sousa', curso_id: 3, curso_nome: 'Engenharia Química', criado_em: '2022-09-01T10:00:00Z', actualizado_em: '2022-09-01T10:00:00Z' },
];

export const mockMateriais: MaterialGet[] = [
  { id: 1, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Ácido Clorídrico (HCl)', categoria: 'composto', quantidade: 2, quantidade_minima: 5, unidade: 'ml', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
  { id: 2, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Béquer 250ml', categoria: 'vidraria', quantidade: 40, quantidade_minima: 10, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 3, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Pipeta Graduada', categoria: 'vidraria', quantidade: 8, quantidade_minima: 12, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 4, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', nome: 'Multímetro Digital', categoria: 'equipamento', quantidade: 15, quantidade_minima: 5, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 5, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', nome: 'Pendulo Simples', categoria: 'equipamento', quantidade: 3, quantidade_minima: 4, unidade: 'un', estado: 'manutencao', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 6, laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', nome: 'Sulfato de Cobre', categoria: 'composto', quantidade: 0, quantidade_minima: 3, unidade: 'g', estado: 'esgotado', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 7, laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', nome: 'Proveta 100ml', categoria: 'vidraria', quantidade: 25, quantidade_minima: 8, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
  { id: 8, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', nome: 'Luvas Nitrilo', categoria: 'consumivel', quantidade: 200, quantidade_minima: 50, unidade: 'un', estado: 'disponivel', criado_em: '2025-01-01T10:00:00Z', actualizado_em: '2025-01-01T10:00:00Z' },
];

export const mockHistorico: HistoricoMaterialGet[] = [
  { id: 1, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: 100, motivo: 'compra_stock', descricao: 'Compra inicial de stock', criado_em: '2025-01-15T10:00:00Z', actualizado_em: '2025-01-15T10:00:00Z' },
  { id: 2, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', actividade_id: 1, actividade_nome: 'Aula Química Orgânica', quantidade_movimentada: -3, motivo: 'consumo_actividade', descricao: 'Consumo em aula prática', criado_em: '2026-06-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
  { id: 3, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: -95, motivo: 'quebra_acidente', descricao: 'Derrame acidental de frasco', criado_em: '2026-06-10T10:00:00Z', actualizado_em: '2026-06-10T10:00:00Z' },
  { id: 4, material_id: 2, material_nome: 'Béquer 250ml', utilizador_id: 2, utilizador_nome: 'Ana Martins', quantidade_movimentada: 50, motivo: 'compra_stock', descricao: 'Compra inicial', criado_em: '2025-01-15T10:00:00Z', actualizado_em: '2025-01-15T10:00:00Z' },
  { id: 5, material_id: 2, material_nome: 'Béquer 250ml', utilizador_id: 2, utilizador_nome: 'Ana Martins', actividade_id: 1, actividade_nome: 'Aula Química Orgânica', quantidade_movimentada: -10, motivo: 'consumo_actividade', descricao: 'Quebra de 10 béqueres em aula', criado_em: '2026-06-01T10:00:00Z', actualizado_em: '2026-06-01T10:00:00Z' },
];

export const mockActividades: ActividadeGet[] = [
  { id: 1, nome: 'Aula Química Orgânica I', criado_por_id: 1, criado_por_nome: 'João Silva', responsavel_id: 1, responsavel_nome: 'João Silva', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', tipo: 'aula', estado: 'revisado_supervisor', num_participantes: 25, precisa_assistente: false, observacoes: 'Aula prática sobre compostos orgânicos', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
  { id: 2, nome: 'Visita Institucional - IST', criado_por_id: 4, criado_por_nome: 'Maria Santos', responsavel_id: 7, responsavel_nome: 'Pedro Almeida', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', tipo: 'visita', estado: 'pendente', num_participantes: 15, precisa_assistente: true, observacoes: 'Visita guiada de estudantes do IST', criado_em: '2026-05-25T10:00:00Z', actualizado_em: '2026-05-25T10:00:00Z' },
  { id: 3, nome: 'Projeto Síntese Verde', criado_por_id: 7, criado_por_nome: 'Pedro Almeida', responsavel_id: 7, responsavel_nome: 'Pedro Almeida', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'projecto', estado: 'revisado_dlab', num_participantes: 4, precisa_assistente: true, observacoes: 'Projeto de síntese de compostos verdes', criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-27T10:00:00Z' },
  { id: 4, nome: 'Estágio - Análise de Águas', criado_por_id: 1, criado_por_nome: 'João Silva', responsavel_id: 1, responsavel_nome: 'João Silva', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'estagio', estado: 'pendente', num_participantes: 1, precisa_assistente: false, observacoes: 'Estágio de análise de águas residuais', criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
  { id: 5, nome: 'Aula Física Aplicada', criado_por_id: 1, criado_por_nome: 'João Silva', responsavel_id: 1, responsavel_nome: 'João Silva', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', tipo: 'aula', estado: 'revisado_dlab', num_participantes: 20, precisa_assistente: false, observacoes: 'Aula sobre movimento oscilatório', criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-26T10:00:00Z' },
  { id: 6, nome: 'Aula Química Analítica', criado_por_id: 7, criado_por_nome: 'Pedro Almeida', responsavel_id: 7, responsavel_nome: 'Pedro Almeida', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', tipo: 'aula', estado: 'rejeitado', num_participantes: 18, precisa_assistente: false, observacoes: 'Aula sobre titulações', criado_em: '2026-05-10T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
];

export const mockAulas: AulaGet[] = [
  { id: 1, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', curso_disciplina_id: 1, curso_disciplina_nome: 'Química Orgânica I (EQ - 3º Sem)', tema: 'Compostos Aromáticos', turno: 'manha', numero_turma: 1, turma: 'EQ_M1', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
  { id: 2, actividade_id: 5, actividade_nome: 'Aula Física Aplicada', curso_disciplina_id: 2, curso_disciplina_nome: 'Física Aplicada (EQ - 4º Sem)', tema: 'Pêndulo Simples', turno: 'tarde', numero_turma: 2, turma: 'EQ_T2', criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-15T10:00:00Z' },
];

export const mockVisitas: VisitaGet[] = [
  { id: 1, actividade_id: 2, actividade_nome: 'Visita Institucional - IST', nome_visitante: 'Prof. Ricardo Gomes', instituicao: 'Instituto Superior Técnico', telefone: '+351 210 000 000', email: 'rgomes@ist.pt', criado_em: '2026-05-25T10:00:00Z', actualizado_em: '2026-05-25T10:00:00Z' },
];

export const mockProjectos: ProjectoGet[] = [
  { id: 1, actividade_id: 3, actividade_nome: 'Projeto Síntese Verde', titulo: 'Síntese de Compostos Verdes', descricao: 'Desenvolvimento de métodos de síntese sustentável', data_inicio: '2026-06-01', data_fim: '2026-12-31', anexo_path: undefined, criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
];

export const mockEstagios: EstagioGet[] = [
  { id: 1, actividade_id: 4, actividade_nome: 'Estágio - Análise de Águas', estudante_id: 20210001, estudante_nome: 'Carlos Mendes', data_inicio: '2026-07-01', data_fim: '2026-12-31', anexo_path: undefined, criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
];

export const mockAgendamentos: AgendamentoGet[] = [
  { id: 1, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-01T09:00:00Z', hora_fim: '2026-06-01T12:00:00Z', confirmado_professor_em: '2026-06-01T12:30:00Z', confirmado_tecnico_em: '2026-06-01T13:00:00Z', realizado: true, estado: 'aprovado_supervisor', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-06-01T13:00:00Z' },
  { id: 2, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-08T09:00:00Z', hora_fim: '2026-06-08T12:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, estado: 'aprovado_supervisor', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
  { id: 3, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', hora_inicio: '2026-06-15T09:00:00Z', hora_fim: '2026-06-15T12:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, estado: 'aprovado_supervisor', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
  { id: 4, actividade_id: 5, actividade_nome: 'Aula Física Aplicada', laboratorio_id: 2, laboratorio_nome: 'Lab. Física', hora_inicio: '2026-06-03T14:00:00Z', hora_fim: '2026-06-03T17:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, estado: 'aprovado_dlab', criado_em: '2026-05-15T10:00:00Z', actualizado_em: '2026-05-15T10:00:00Z' },
  { id: 5, actividade_id: 3, actividade_nome: 'Projeto Síntese Verde', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', hora_inicio: '2026-06-10T10:00:00Z', hora_fim: '2026-06-10T13:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, estado: 'aprovado_dlab', criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
  { id: 6, actividade_id: 3, actividade_nome: 'Projeto Síntese Verde', laboratorio_id: 3, laboratorio_nome: 'Lab. Química 2', hora_inicio: '2026-06-17T10:00:00Z', hora_fim: '2026-06-17T13:00:00Z', confirmado_professor_em: null, confirmado_tecnico_em: null, realizado: false, estado: 'aprovado_dlab', criado_em: '2026-05-22T10:00:00Z', actualizado_em: '2026-05-22T10:00:00Z' },
];

export const mockAprovacoes: AprovacaoGet[] = [
  { id: 1, agendamento_id: 1, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'aprovado', comentario: 'Proposta adequada, laboratório disponível.', decidido_em: '2026-05-28T10:00:00Z', criado_em: '2026-05-28T10:00:00Z', actualizado_em: '2026-05-28T10:00:00Z' },
  { id: 2, agendamento_id: 1, aprovador_id: 5, aprovador_nome: 'Rui Fernandes', etapa: 'supervisor', decisao: 'aprovado', comentario: 'Aprovado. Técnico atribuído.', decidido_em: '2026-05-29T10:00:00Z', criado_em: '2026-05-29T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
  { id: 3, agendamento_id: 4, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'aprovado', comentario: 'Sem problemas.', decidido_em: '2026-05-26T10:00:00Z', criado_em: '2026-05-26T10:00:00Z', actualizado_em: '2026-05-26T10:00:00Z' },
  { id: 4, agendamento_id: 9, aprovador_id: 4, aprovador_nome: 'Maria Santos', etapa: 'dlab', decisao: 'rejeitado', comentario: 'Choque de horário com outra atividade já aprovada.', decidido_em: '2026-05-20T10:00:00Z', criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
];

export const mockActividadeTecnicos: ActividadeTecnicoGet[] = [
  { id: 1, actividade_id: 1, actividade_nome: 'Aula Química Orgânica I', utilizador_id: 2, utilizador_nome: 'Ana Martins', papel: 'validador', criado_em: '2026-05-29T10:00:00Z', actualizado_em: '2026-05-29T10:00:00Z' },
];

export const mockActividadeMateriais: ActividadeMaterialGet[] = [
  { id: 1, actividade_id: 1, material_id: 1, material_nome: 'Ácido Clorídrico (HCl)', quantidade_estimada: 200, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
  { id: 2, actividade_id: 1, material_id: 2, material_nome: 'Béquer 250ml', quantidade_estimada: 10, criado_em: '2026-05-20T10:00:00Z', actualizado_em: '2026-05-20T10:00:00Z' },
];

export const mockRelatorios: RelatorioGet[] = [
  { id: 1, laboratorio_id: 1, laboratorio_nome: 'Lab. Química 1', criado_por: 2, criado_por_nome: 'Ana Martins', mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 14, total_realizadas: 12, total_materiais_baixados: 8, por_tipo: [{ tipo: 'aula', count: 8 }, { tipo: 'visita', count: 2 }, { tipo: 'projecto', count: 3 }, { tipo: 'estagio', count: 1 }], por_lab: [{ lab: 'Lab. Química 1', count: 14 }] }), criado_em: '2026-07-01T10:00:00Z', actualizado_em: '2026-07-01T10:00:00Z' },
  { id: 2, laboratorio_id: 2, laboratorio_nome: 'Lab. Física', criado_por: 3, criado_por_nome: 'Carlos Pereira', mes: 6, ano: 2026, dados_json: JSON.stringify({ total_actividades: 8, total_realizadas: 6, total_materiais_baixados: 3, por_tipo: [{ tipo: 'aula', count: 5 }, { tipo: 'visita', count: 3 }], por_lab: [{ lab: 'Lab. Física', count: 8 }] }), criado_em: '2026-07-01T10:00:00Z', actualizado_em: '2026-07-01T10:00:00Z' },
];

let nextId = 1000;
export function genId(): number {
  return ++nextId;
}
