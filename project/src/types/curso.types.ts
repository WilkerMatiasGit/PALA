import type { DepartamentoTipo } from '@/services/enums';

export interface CursoGet {
  id: number;
  departamento: DepartamentoTipo;
  nome: string;
  abreviacao: string;
  criado_em: string;
  actualizado_em: string;
}

export interface CursoUpsert {
  id?: number;
  departamento: DepartamentoTipo;
  nome: string;
  abreviacao: string;
}
