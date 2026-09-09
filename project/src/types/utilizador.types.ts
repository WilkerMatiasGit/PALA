import type { UtilizadorTipo } from '@/services/enums';

export interface UtilizadorGet {
  id: number;
  nome: string;
  email: string;
  tipo: UtilizadorTipo;
  criado_em: string;
  actualizado_em: string;
}

export interface UtilizadorUpsert {
  id?: number;
  nome: string;
  email: string;
  senha?: string;
  tipo: UtilizadorTipo;
}

export interface ResetPassword {
  id: number;
  nova_senha: string;
}
