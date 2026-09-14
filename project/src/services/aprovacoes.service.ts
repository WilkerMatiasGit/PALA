import { api, apiErrorMessage } from './api';
import type { AprovacaoGet, AprovacaoCreate } from '@/types/aprovacao.types';

export const aprovacoesService = {
  // GET /aprovacoes — fila adaptativa (backend decide por role via JWT)
  async listFila(_userTipo?: string): Promise<AprovacaoGet[]> {
    const { data } = await api.get<AprovacaoGet[]>('/aprovacoes');
    return data;
  },

  // GET /aprovacoes/:id — :id é o actividad_id (fila keyed por atividade)
  async get(id: number): Promise<AprovacaoGet> {
    try {
      const { data } = await api.get<AprovacaoGet>(`/aprovacoes/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async listByActividade(actividadeId: number): Promise<AprovacaoGet[]> {
    const { data } = await api.get<AprovacaoGet[]>(`/actividades/${actividadeId}/aprovacoes`);
    return data;
  },

  // POST /aprovacoes — voto INDIVIDUAL por agendamento (aprovador derivado do JWT)
  async create(data: AprovacaoCreate, _aprovadorId?: number): Promise<AprovacaoGet> {
    try {
      const { data: created } = await api.post<AprovacaoGet>('/aprovacoes', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/:id/finalizar — concluir a revisão da etapa da atividade.
  // O comentário/parecer da sessão é obrigatório na conclusão.
  async finalizar(actividadeId: number, comentario: string): Promise<{ message: string; estado: string }> {
    try {
      const { data } = await api.post(`/aprovacoes/${actividadeId}/finalizar`, { comentario });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/pendente — "Deixar pendente" (apenas etapa DLab)
  async deixarPendente(agendamentoId: number): Promise<void> {
    try {
      await api.post('/aprovacoes/pendente', { agendamento_id: agendamentoId });
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/rollback — reverter a decisão individual de um agendamento
  async rollback(agendamentoId: number, etapa: 'dlab' | 'supervisor'): Promise<{ message: string; estado: string }> {
    try {
      const { data } = await api.post('/aprovacoes/rollback', { agendamento_id: agendamentoId, etapa });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /aprovacoes/:id/rejeitar — rejeição explícita da atividade inteira
  async rejeitarActividade(actividadeId: number, comentario: string): Promise<AprovacaoGet> {
    try {
      const { data } = await api.post<AprovacaoGet>(`/aprovacoes/${actividadeId}/rejeitar`, { comentario });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
