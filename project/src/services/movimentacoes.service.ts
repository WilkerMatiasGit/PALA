import { api, apiErrorMessage } from './api';
import type { HistoricoMaterialGet, HistoricoMaterialUpsert } from '@/types/material.types';

export const movimentacoesService = {
  async listAll(filters?: { material_id?: number; motivo?: string }): Promise<HistoricoMaterialGet[]> {
    const { data } = await api.get<HistoricoMaterialGet[]>('/materiais/historico', { params: filters });
    return data;
  },

  async listByMaterial(materialId: number): Promise<HistoricoMaterialGet[]> {
    const { data } = await api.get<HistoricoMaterialGet[]>(`/materiais/${materialId}/historico`);
    return data;
  },

  async create(data: HistoricoMaterialUpsert): Promise<HistoricoMaterialGet> {
    try {
      const { data: created } = await api.post<HistoricoMaterialGet>('/materiais/historico', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
