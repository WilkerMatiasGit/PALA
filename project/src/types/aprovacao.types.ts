import type {
  ActividadeEstado,
  ActividadeTipo,
  AgendamentoEstado,
  AprovacaoEtapa,
  AprovacaoDecisao,
} from '@/services/enums';

/** Uma decisão registada sobre um agendamento (log imutável). */
export interface DecisaoGet {
  id: number;
  agendamento_id: number;
  decisor_id: number;
  decisor_nome: string;
  etapa: AprovacaoEtapa;
  decisao: AprovacaoDecisao;
  comentario: string;
  criado_em: string;
  agendamento_nome?: string;
  h_inicio?: string;
  h_fim?: string;
}

/** Linha da fila: uma atividade com N agendamentos à espera de decisão. */
export interface AprovacaoFilaItem {
  id: number;
  nome: string;
  estado: ActividadeEstado;
  criado_em: string;
  em_espera: number;
}

/** Agendamento dentro do detalhe de aprovação, com a etapa que o aguarda. */
export interface AprovacaoAgendamentoDetalhe {
  id: number;
  num_participantes: number;
  hora_inicio: string;
  hora_fim: string;
  estado: AgendamentoEstado;
  realizado: boolean;
  confirmado_professor_em: string | null;
  confirmado_tecnico_em: string | null;
  etapa_alvo: AprovacaoEtapa | null;
  pode_decidir: boolean;
  decisoes: DecisaoGet[];
  validador_id: number | null;
  validador_nome: string;
  assistente_id: number | null;
  assistente_nome: string;
}

/** Detalhe da atividade em aprovação. */
export interface AprovacaoDetalheGet {
  id: number;
  nome: string;
  tipo: ActividadeTipo;
  estado: ActividadeEstado;
  /** Rejeição da atividade inteira possível para este utilizador neste momento. */
  pode_rejeitar_atividade: boolean;
  laboratorio_id: number;
  laboratorio_nome: string;
  responsavel_id: number;
  responsavel_nome: string;
  criado_por_nome: string;
  observacoes: string;
  criado_em: string;
  actualizado_em: string;
  agendamentos: AprovacaoAgendamentoDetalhe[];
}

export interface AprovacaoCreate {
  agendamento_id: number;
  etapa: AprovacaoEtapa;
  decisao: AprovacaoDecisao;
  comentario?: string;
  /** Obrigatório quando etapa=supervisor e decisao=aprovado. */
  tecnicos?: { validador_id: number; assistente_id: number };
}

export interface AprovacaoLoteItem {
  agendamento_id: number;
  decisao: AprovacaoDecisao;
}

/** A etapa é derivada do estado de cada agendamento — não é enviada. */
export interface AprovacaoLote {
  itens: AprovacaoLoteItem[];
  comentario?: string;
}
