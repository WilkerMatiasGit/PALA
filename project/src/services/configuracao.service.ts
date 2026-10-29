import { api, apiErrorMessage } from './api';
import type {
  FluxoEtapaGet,
  FluxoUpdate,
  LimiteParticipantesGet,
  ConfiguracaoGeralGet,
  FeriadoGet,
  FeriadoUpsert,
  FeriadoAfectadoResposta,
} from '@/types/configuracao.types';

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

  // GET /configuracao/limites — limites de participantes por tipo (qualquer autenticado)
  async getLimites(): Promise<LimiteParticipantesGet[]> {
    try {
      const { data } = await api.get<LimiteParticipantesGet[]>('/configuracao/limites');
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // PUT /configuracao/limites — guardar os 4 tipos (A)
  async updateLimites(itens: LimiteParticipantesGet[]): Promise<LimiteParticipantesGet[]> {
    try {
      const { data } = await api.put<LimiteParticipantesGet[]>('/configuracao/limites', { itens });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // GET /configuracao/geral — configurações gerais (qualquer autenticado)
  async getGeral(): Promise<ConfiguracaoGeralGet> {
    try {
      const { data } = await api.get<ConfiguracaoGeralGet>('/configuracao/geral');
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // PUT /configuracao/geral — guardar as configurações gerais (A)
  async updateGeral(data: Partial<ConfiguracaoGeralGet>): Promise<ConfiguracaoGeralGet> {
    try {
      const { data: updated } = await api.put<ConfiguracaoGeralGet>('/configuracao/geral', data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // GET /configuracao/feriados — lista de feriados activos (qualquer autenticado)
  async listFeriados(): Promise<FeriadoGet[]> {
    try {
      const { data } = await api.get<FeriadoGet[]>('/configuracao/feriados');
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /configuracao/feriados — criar feriado (A)
  async createFeriado(payload: FeriadoUpsert): Promise<FeriadoAfectadoResposta> {
    try {
      const { data } = await api.post<FeriadoAfectadoResposta>('/configuracao/feriados', payload);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // PUT /configuracao/feriados/:id — actualizar feriado (A)
  async updateFeriado(id: number, payload: Partial<FeriadoUpsert>): Promise<FeriadoAfectadoResposta> {
    try {
      const { data } = await api.put<FeriadoAfectadoResposta>(`/configuracao/feriados/${id}`, payload);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // DELETE /configuracao/feriados/:id — remover feriado (A)
  async removeFeriado(id: number): Promise<void> {
    try {
      await api.delete(`/configuracao/feriados/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};