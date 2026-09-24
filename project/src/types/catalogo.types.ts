export interface CatalogoGet {
  id: number;
  nome: string;
  criado_em: string;
  actualizado_em: string;
}

export interface CatalogoUpsert {
  id?: number;
  nome: string;
  descricao?: string;
}