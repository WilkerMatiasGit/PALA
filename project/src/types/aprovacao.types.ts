import type { AprovacaoEtapa, AprovacaoDecisao } from '@/services/enums';

export interface AprovacaoAgendamentoItem {
  agendamento_id?: number;
  agendamento_nome?: string;
  h_inicio?: string | null;
  h_fim?: string | null;
  decisao: AprovacaoDecisao;
}

export interface AprovacaoGet {
  id: number;
  agendamento_id?: number;
  actividade_id?: number;
  actividade_nome?: string;
  aprovador_id: number;
  aprovador_nome: string;
  etapa: AprovacaoEtapa;
  decisao: AprovacaoDecisao;
  comentario: string;
  agendamentos?: AprovacaoAgendamentoItem[];
  decidido_em: string;
  criado_em: string;
  actualizado_em: string;
}

export interface AprovacaoCreate {
  agendamento_id: number;
  etapa: AprovacaoEtapa;
  decisao: AprovacaoDecisao;
  comentario?: string;
}

export interface AprovacaoLoteItem {
  agendamento_id: number;
  decisao: AprovacaoDecisao;
}

export interface AprovacaoLote {
  etapa: AprovacaoEtapa;
  itens: AprovacaoLoteItem[];
  comentario?: string;
}