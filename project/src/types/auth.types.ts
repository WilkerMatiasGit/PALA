import type { UtilizadorTipo } from '@/services/enums';

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  tipo: UtilizadorTipo;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}
