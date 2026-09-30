import { api, apiErrorMessage } from './api';
import type {
  AprovacaoCreate,
  AprovacaoDetalheGet,
  AprovacaoFilaItem,
  AprovacaoLote,
  DecisaoGet,
} from '@/types/aprovacao.types';

export const aprovacoesService = {
  // GET /aprovacoes — fila de atividades com agendamentos por decidir.
  // O estado da etapa (dlab/supervisor) e filtrado no backend a partir do role.
  async listFila(): Promise<AprovacaoFilaItem[]> {
    const { data } = await api.get<AprovacaoFilaItem[]>('/aprovacoes');
    return data;
  },

  // GET /aprovacoes/:id — :id é o actividade_id
  async get(id: number): Promise<AprovacaoDetalheGet> {
    try {
      const { data } = await api.get<AprovacaoDetalheGet>(`/aprovacoes/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // GET /actividades/:id/decisoes — histórico de decisões (log imutável)
  async listDecisoes(actividadeId: number): Promise<DecisaoGet[]> {
    const { data } = await api.get<DecisaoGet[]>(`/actividades/${actividadeId}/decisoes`);
    return data;
  },

  // POST /aprovacoes — decisão individual sobre um agendamento
  async create(data: AprovacaoCreate): Promise<DecisaoGet> {
    try {
      const { data: created } = await api.post<DecisaoGet>('/aprovacoes', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/lote — decisão em massa (a etapa é deduzida de cada agendamento)
  async createLote(data: AprovacaoLote): Promise<DecisaoGet[]> {
    try {
      const { data: created } = await api.post<DecisaoGet[]>('/aprovacoes/lote', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/pendente — "Deixar pendente" (não cria decisão, mantém a fila)
  async deixarPendente(agendamentoId: number): Promise<void> {
    try {
      await api.post('/aprovacoes/pendente', { agendamento_id: agendamentoId });
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/:id/rejeitar — rejeita todos os agendamentos em espera
  async rejeitarActividade(
    actividadeId: number,
    comentario: string
  ): Promise<{ message: string; rejeitados: number }> {
    try {
      const { data } = await api.post<{ message: string; rejeitados: number }>(
        `/aprovacoes/${actividadeId}/rejeitar`,
        { comentario }
      );
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
