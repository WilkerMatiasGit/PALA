import type { LaboratorioTipo } from '@/services/enums';

export interface LaboratorioGet {
  id: number;
  nome: string;
  tipo: LaboratorioTipo;
  descricao: string;
  criado_em: string;
  actualizado_em: string;
}

export interface LaboratorioUpsert {
  id?: number;
  nome: string;
  tipo: LaboratorioTipo;
  descricao: string;
}
