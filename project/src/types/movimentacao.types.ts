export interface MovimentacaoGet {
  id: number;
  material_id: number;
  material_nome: string;
  utilizador_id: number;
  utilizador_nome: string;
  actividade_id?: number;
  actividade_nome?: string;
  quantidade_movimentada: number;
  motivo: string;
  descricao: string;
  criado_em: string;
  actualizado_em: string;
}
