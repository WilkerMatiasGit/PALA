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
