import type { UtilizadorTipo } from '@/services/enums';

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