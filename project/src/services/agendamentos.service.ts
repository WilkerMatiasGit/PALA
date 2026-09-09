import { api, apiErrorMessage } from './api';
import type { AgendamentoGet, AgendamentoUpsert } from '@/types/agendamento.types';

export const agendamentosService = {
  async list(filters?: { laboratorio_id?: number; mes?: number; ano?: number }): Promise<AgendamentoGet[]> {
    const { data } = await api.get<AgendamentoGet[]>('/agendamentos', { params: filters });
    return data;
  },

  async listByActividade(actividadeId: number): Promise<AgendamentoGet[]> {
    const { data } = await api.get<AgendamentoGet[]>(`/actividades/${actividadeId}/agendamentos`);
    return data;
  },

  async create(data: AgendamentoUpsert): Promise<AgendamentoGet> {
    try {
      const { data: created } = await api.post<AgendamentoGet>('/agendamentos', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async update(id: number, data: AgendamentoUpsert): Promise<AgendamentoGet> {
    try {
      const { data: updated } = await api.put<AgendamentoGet>(`/agendamentos/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async confirmarProfessor(id: number): Promise<AgendamentoGet> {
    try {
      const { data } = await api.put<AgendamentoGet>(`/agendamentos/${id}/confirmar-professor`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async confirmarTecnico(id: number): Promise<AgendamentoGet> {
    try {
      const { data } = await api.put<AgendamentoGet>(`/agendamentos/${id}/confirmar-tecnico`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/agendamentos/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
