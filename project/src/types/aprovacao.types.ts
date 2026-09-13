import type { AprovacaoEtapa, AprovacaoDecisao } from '@/services/enums';

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