export interface DisciplinaGet {
  id: number;
  nome: string;
  criado_em: string;
  actualizado_em: string;
}

export interface DisciplinaUpsert {
  id?: number;
  nome: string;
}

export interface CursoDisciplinaGet {
  id: number;
  curso_id: number;
  curso_nome: string;
  disciplina_id: number;
  disciplina_nome: string;
  semestre: number;
  criado_em: string;
  actualizado_em: string;
}

export interface CursoDisciplinaUpsert {
  id?: number;
  curso_id: number;
  disciplina_id: number;
  semestre: number;
}
