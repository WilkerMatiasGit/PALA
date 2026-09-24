import { api, apiErrorMessage } from './api';
import type { RelatorioGet, RelatorioCreate } from '@/types/relatorio.types';

export const relatoriosService = {
  async list(): Promise<RelatorioGet[]> {
    const { data } = await api.get<RelatorioGet[]>('/relatorios');
    return data;
  },

  async get(id: number): Promise<RelatorioGet> {
    try {
      const { data } = await api.get<RelatorioGet>(`/relatorios/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // POST /relatorios — gerar contagens (criador derivado do JWT)
  async create(data: RelatorioCreate): Promise<RelatorioGet> {
    try {
      const { data: created } = await api.post<RelatorioGet>('/relatorios', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async exportarPdf(id: number): Promise<Blob> {
    try {
      const res = await api.get(`/relatorios/${id}/pdf`, { responseType: 'blob' });
      return res.data as Blob;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
