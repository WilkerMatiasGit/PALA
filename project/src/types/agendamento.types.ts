import type { AgendamentoEstado, TecnicoTipo } from '@/services/enums';

export interface AgendamentoGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  laboratorio_id: number;
  laboratorio_nome: string;
  num_participantes: number;
  hora_inicio: string;
  hora_fim: string;
  confirmado_professor_em: string | null;
  confirmado_tecnico_em: string | null;
  realizado: boolean;
  estado: AgendamentoEstado;
  validador_id: number | null;
  validador_nome: string;
  assistente_id: number | null;
  assistente_nome: string;
  criado_em: string;
  actualizado_em: string;
}

export interface AgendamentoUpsert {
  id?: number;
  actividade_id: number;
  num_participantes: number;
  hora_inicio: string;
  hora_fim: string;
}

/** Atribuição de técnico por agendamento (validador | assistente). */
export interface AgendamentoTecnicoGet {
  id: number;
  agendamento_id: number;
  agendamento_nome?: string;
  utilizador_id: number;
  utilizador_nome: string;
  papel: TecnicoTipo;
  criado_em: string;
  actualizado_em: string;
}

export interface AgendamentoTecnicosPayload {
  validador_id: number;
  assistente_id: number;
}
