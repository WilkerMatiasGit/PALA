import type { UtilizadorTipo, ActividadeTipo } from '@/services/enums';

export interface FluxoEtapaGet {
  nome: string;
  ordem: number;
  cargos: UtilizadorTipo[];
}

export interface FluxoEtapaUpsert {
  nome: string;
  ordem: number;
  cargos: UtilizadorTipo[];
}

export interface FluxoUpdate {
  itens: FluxoEtapaUpsert[];
}

export interface LimiteParticipantesGet {
  id: number;
  tipo: ActividadeTipo;
  min: number;
  max: number;
  limite_activo: boolean;
}

export interface LimiteParticipantesUpsert {
  tipo: ActividadeTipo;
  min: number;
  max: number;
  limite_activo: boolean;
}

export interface LimitesUpdate {
  itens: LimiteParticipantesGet[];
}

export interface ConfiguracaoGeralGet {
  permitir_fim_semana: boolean;
  permitir_feriados: boolean;
}

export type FeriadoTipo = 'feriado' | 'feriado_movel' | 'ponte' | 'tolerancia';

export interface FeriadoGet {
  id: number;
  nome: string;
  data: string;
  tipo: FeriadoTipo;
  activo: boolean;
  criado_em?: string;
  actualizado_em?: string;
}

export interface FeriadoUpsert {
  nome: string;
  data: string;
  tipo: FeriadoTipo;
}

export interface FeriadoAfectadoResposta extends FeriadoGet {
  sessoes_afectadas_count?: number;
  actividades_afectadas?: Array<{ id: number; nome: string; sessoes?: Array<{ agendamento_id: number; data: string }> }>;
}