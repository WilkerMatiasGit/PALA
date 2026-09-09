import type {
  MaterialCategoria,
  MaterialEstado,
  MovimentacaoMotivo,
} from '@/services/enums';

export interface MaterialGet {
  id: number;
  laboratorio_id: number;
  laboratorio_nome: string;
  nome: string;
  categoria: MaterialCategoria;
  quantidade: number;
  quantidade_minima: number;
  unidade: string;
  estado: MaterialEstado;
  criado_em: string;
  actualizado_em: string;
}

export interface MaterialUpsert {
  id?: number;
  laboratorio_id: number;
  nome: string;
  categoria: MaterialCategoria;
  quantidade_minima: number;
  unidade: string;
  estado: MaterialEstado;
  quantidade_inicial?: number;
}

export interface HistoricoMaterialGet {
  id: number;
  material_id: number;
  material_nome: string;
  utilizador_id: number;
  utilizador_nome: string;
  actividade_id?: number;
  actividade_nome?: string;
  quantidade_movimentada: number;
  motivo: MovimentacaoMotivo;
  descricao: string;
  criado_em: string;
  actualizado_em: string;
}

export interface HistoricoMaterialUpsert {
  id?: number;
  material_id: number;
  utilizador_id: number;
  actividade_id?: number;
  quantidade_movimentada: number;
  motivo: MovimentacaoMotivo;
  descricao: string;
}
