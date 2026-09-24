import type { ActividadeTipo, ActividadeEstado } from '@/services/enums';

export interface EstudanteGet {
  id: number;
  nome: string;
  curso_id: number;
  curso_nome: string;
  criado_em: string;
  actualizado_em: string;
}

export interface EstudanteUpsert {
  id?: number;
  nome: string;
  curso_id: number;
}

export interface EstudanteActividadeGet {
  estagio_id: number;
  actividade_id?: number;
  nome?: string;
  tipo?: ActividadeTipo;
  estado?: ActividadeEstado;
  laboratorio_id?: number | null;
  laboratorio_nome?: string;
  responsavel_id?: number | null;
  responsavel_nome?: string;
  criado_em?: string;
  actualizado_em?: string;
  data_inicio: string;
  data_fim: string;
}
