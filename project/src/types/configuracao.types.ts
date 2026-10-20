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
}