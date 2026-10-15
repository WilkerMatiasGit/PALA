import { api, apiErrorMessage } from './api';
import type { MaterialGet, MaterialOpcao, MaterialUpsert } from '@/types/material.types';

export const materiaisService = {
  async list(filters?: { laboratorio_id?: number; categoria?: string; estado?: string }): Promise<MaterialGet[]> {
    const { data } = await api.get<MaterialGet[]>('/materiais', { params: filters });
    return data;
  },

  // Opções mínimas para o formulário de actividades (acessível também a professores).
  async listOpcoes(laboratorioId: number): Promise<MaterialOpcao[]> {
    const { data } = await api.get<MaterialOpcao[]>('/materiais/opcoes', { params: { laboratorio_id: laboratorioId } });
    return data;
  },

  async get(id: number): Promise<MaterialGet> {
    try {
      const { data } = await api.get<MaterialGet>(`/materiais/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async create(data: MaterialUpsert): Promise<MaterialGet> {
    try {
      const { data: created } = await api.post<MaterialGet>('/materiais', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async update(id: number, data: MaterialUpsert): Promise<MaterialGet> {
    try {
      const { data: updated } = await api.put<MaterialGet>(`/materiais/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/materiais/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
