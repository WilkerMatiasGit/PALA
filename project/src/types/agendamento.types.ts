import type { AgendamentoEstado } from '@/services/enums';

export interface AgendamentoGet {
  id: number;
  actividade_id: number;
  actividade_nome: string;
  laboratorio_id: number;
  laboratorio_nome: string;
  hora_inicio: string;
  hora_fim: string;
  confirmado_professor_em: string | null;
  confirmado_tecnico_em: string | null;
  realizado: boolean;
  estado: AgendamentoEstado;
  criado_em: string;
  actualizado_em: string;
}

export interface AgendamentoUpsert {
  id?: number;
  actividade_id: number;
  hora_inicio: string;
  hora_fim: string;
}
