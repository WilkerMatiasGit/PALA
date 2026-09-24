import { api, apiErrorMessage } from './api';
import type { FluxoEtapaGet, FluxoUpdate } from '@/types/configuracao.types';

export const configuracaoService = {
  // GET /configuracao/fluxo — etapas ativas por ordem (A,C,S)
  async getFluxo(): Promise<FluxoEtapaGet[]> {
    try {
      const { data } = await api.get<FluxoEtapaGet[]>('/configuracao/fluxo');
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // PUT /configuracao/fluxo — substituir o fluxo ativo (A)
  async updateFluxo(data: FluxoUpdate): Promise<FluxoEtapaGet[]> {
    try {
      const { data: updated } = await api.put<FluxoEtapaGet[]>('/configuracao/fluxo', data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /configuracao/fluxo/reset — repor o padrão DLab → Supervisor (A)
  async resetFluxo(): Promise<FluxoEtapaGet[]> {
    try {
      const { data } = await api.post<FluxoEtapaGet[]>('/configuracao/fluxo/reset');
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};