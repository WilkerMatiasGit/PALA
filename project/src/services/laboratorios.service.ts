import { api, apiErrorMessage } from './api';
import type { LaboratorioGet, LaboratorioUpsert } from '@/types/laboratorio.types';

export const laboratoriosService = {
  async list(): Promise<LaboratorioGet[]> {
    const { data } = await api.get<LaboratorioGet[]>('/labs');
    return data;
  },

  async get(id: number): Promise<LaboratorioGet> {
    try {
      const { data } = await api.get<LaboratorioGet>(`/labs/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async create(data: LaboratorioUpsert): Promise<LaboratorioGet> {
    try {
      const { data: created } = await api.post<LaboratorioGet>('/labs', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async update(id: number, data: LaboratorioUpsert): Promise<LaboratorioGet> {
    try {
      const { data: updated } = await api.put<LaboratorioGet>(`/labs/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/labs/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
