export interface LaboratorioGet {
  id: number;
  nome: string;
  tipo: string;
  descricao: string;
  criado_em: string;
  actualizado_em: string;
}

export interface LaboratorioUpsert {
  id?: number;
  nome: string;
  tipo: string;
  descricao: string;
}
