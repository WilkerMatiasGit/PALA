import type {
  ActividadeTipo,
  ActividadeEstado,
} from '@/services/enums';

export interface ActividadeGet {
  id: number;
  nome: string;
  utilizador_id: number;
  utilizador_nome: string;
  laboratorio_id: number;
  laboratorio_nome: string;
  tipo: ActividadeTipo;
  estado: ActividadeEstado;
  num_participantes: number;
  precisa_assistente: boolean;
  observacoes: string;
  criado_em: string;
  actualizado_em: string;
}

export interface ActividadeUpsert {
  id?: number;
  nome: string;
  utilizador_id: number;
  laboratorio_id: number;
  num_participantes: number;
  observacoes: string;
  precisa_assistente: boolean;
  tipo: ActividadeTipo;
}

export type ActividadeDetalhesPayload =
  | { curso_disciplina_id: number; tema: string }
  | { nome_visitante: string; instituicao?: string; telefone: string; email: string }
  | { responsavel_id: number; titulo: string; descricao: string; data_inicio: string; data_fim: string }
  | { responsavel_id: number; estudante_id: number; data_inicio: string; data_fim: string };

export interface ActividadeFullUpsert extends ActividadeUpsert {
  detalhes?: ActividadeDetalhesPayload;
  agendamentos?: { hora_inicio: string; hora_fim: string }[];
  materiais?: { material_id: number; quantidade_estimada: number }[];
}

export interface AulaGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  curso_disciplina_id: number;
  curso_disciplina_nome: string;
  tema: string;
  criado_em: string;
  actualizado_em: string;
}

export interface AulaUpsert {
  id?: number;
  actividade_id: number;
  curso_disciplina_id: number;
  tema: string;
}

export interface VisitaGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  nome_visitante: string;
  instituicao?: string;
  telefone: string;
  email: string;
  criado_em: string;
  actualizado_em: string;
}

export interface VisitaUpsert {
  id?: number;
  actividade_id: number;
  nome_visitante: string;
  instituicao?: string;
  telefone: string;
  email: string;
}

export interface ProjectoGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  responsavel_id: number;
  responsavel_nome: string;
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  anexo_path?: string;
  criado_em: string;
  actualizado_em: string;
}

export interface ProjectoUpsert {
  id?: number;
  actividade_id: number;
  responsavel_id: number;
  titulo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
}

export interface EstagioGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  responsavel_id: number;
  responsavel_nome: string;
  estudante_id: number;
  estudante_nome: string;
  data_inicio: string;
  data_fim: string;
  anexo_path?: string;
  criado_em: string;
  actualizado_em: string;
}

export interface EstagioUpsert {
  id?: number;
  actividade_id: number;
  responsavel_id: number;
  estudante_id: number;
  data_inicio: string;
  data_fim: string;
}

export interface ActividadeTecnicoGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  utilizador_id: number;
  utilizador_nome: string;
  papel: 'validador' | 'assistente';
  criado_em: string;
  actualizado_em: string;
}

export interface ActividadeTecnicoUpsert {
  id?: number;
  actividade_id: number;
  utilizador_id: number;
  papel: 'validador' | 'assistente';
}

export interface ActividadeMaterialGet {
  id: number;
  actividade_id: number;
  material_id: number;
  material_nome: string;
  quantidade_estimada: number;
  criado_em: string;
  actualizado_em: string;
}

export interface ActividadeMaterialUpsert {
  id?: number;
  actividade_id: number;
  material_id: number;
  quantidade_estimada: number;
}
