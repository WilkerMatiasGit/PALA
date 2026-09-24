import { api, apiErrorMessage } from './api';
import type { UtilizadorGet, UtilizadorUpsert, ResetPassword, PerfilSenha } from '@/types/utilizador.types';

export const utilizadoresService = {
  async list(): Promise<UtilizadorGet[]> {
    const { data } = await api.get<UtilizadorGet[]>('/user');
    return data;
  },

  async listTecnicos(): Promise<UtilizadorGet[]> {
    const { data } = await api.get<UtilizadorGet[]>('/user/tecnicos');
    return data;
  },

  async getMe(): Promise<UtilizadorGet> {
    const { data } = await api.get<UtilizadorGet>('/user/me');
    return data;
  },

  async get(id: number): Promise<UtilizadorGet> {
    try {
      const { data } = await api.get<UtilizadorGet>(`/user/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async create(data: UtilizadorUpsert): Promise<UtilizadorGet> {
    try {
      const { data: created } = await api.post<UtilizadorGet>('/user', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async update(id: number, data: UtilizadorUpsert): Promise<UtilizadorGet> {
    try {
      const { data: updated } = await api.put<UtilizadorGet>(`/user/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // PUT /user/:id — alteração da própria senha (exige senha_actual)
  async changePassword(id: number, data: PerfilSenha): Promise<UtilizadorGet> {
    try {
      const { data: updated } = await api.put<UtilizadorGet>(`/user/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async resetPassword(req: ResetPassword): Promise<void> {
    try {
      await api.put(`/user/reset-password`, req);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/user/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
