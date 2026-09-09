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

  // POST /aprovacoes — emitir voto (aprovador derivado do JWT)
  async create(data: AprovacaoCreate, _aprovadorId?: number): Promise<AprovacaoGet> {
    try {
      const { data: created } = await api.post<AprovacaoGet>('/aprovacoes', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
