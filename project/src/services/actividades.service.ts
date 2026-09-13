import { api, apiErrorMessage } from './api';
import type {
  ActividadeGet,
  ActividadeUpsert,
  ActividadeFullUpsert,
  AulaGet,
  AulaUpsert,
  VisitaGet,
  VisitaUpsert,
  ProjectoGet,
  ProjectoUpsert,
  EstagioGet,
  EstagioUpsert,
  ActividadeTecnicoGet,
  ActividadeTecnicoUpsert,
  ActividadeMaterialGet,
  ActividadeMaterialUpsert,
} from '@/types/actividade.types';

export interface ActividadeListFilters {
  tipo?: string;
  estado?: string;
  laboratorio_id?: number;
}

export const actividadesService = {
  async list(filters?: ActividadeListFilters): Promise<ActividadeGet[]> {
    const { data } = await api.get<ActividadeGet[]>('/actividades', { params: filters });
    return data;
  },

  async get(id: number): Promise<ActividadeGet> {
    try {
      const { data } = await api.get<ActividadeGet>(`/actividades/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async create(data: ActividadeUpsert): Promise<ActividadeGet> {
    try {
      const { data: created } = await api.post<ActividadeGet>('/actividades', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async update(id: number, data: ActividadeUpsert): Promise<ActividadeGet> {
    try {
      const { data: updated } = await api.put<ActividadeGet>(`/actividades/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Criação/edição atómica (atividade + detalhes + agendamentos + materiais) ----
  async createFull(data: ActividadeFullUpsert): Promise<ActividadeGet> {
    try {
      const { data: created } = await api.post<ActividadeGet>('/actividades/full', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async updateFull(id: number, data: ActividadeFullUpsert): Promise<ActividadeGet> {
    try {
      const { data: updated } = await api.put<ActividadeGet>(`/actividades/${id}/full`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/actividades/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Especializações ----
  async getAula(actividadeId: number): Promise<AulaGet | null> {
    const { data } = await api.get<AulaGet | null>(`/actividades/${actividadeId}/aula`);
    return data;
  },
  async upsertAula(data: AulaUpsert): Promise<AulaGet> {
    try {
      const { data: result } = await api.post<AulaGet>('/aulas', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async getVisita(actividadeId: number): Promise<VisitaGet | null> {
    const { data } = await api.get<VisitaGet | null>(`/actividades/${actividadeId}/visita`);
    return data;
  },
  async upsertVisita(data: VisitaUpsert): Promise<VisitaGet> {
    try {
      const { data: result } = await api.post<VisitaGet>('/visitas', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async getProjecto(actividadeId: number): Promise<ProjectoGet | null> {
    const { data } = await api.get<ProjectoGet | null>(`/actividades/${actividadeId}/projecto`);
    return data;
  },
  async upsertProjecto(data: ProjectoUpsert): Promise<ProjectoGet> {
    try {
      const { data: result } = await api.post<ProjectoGet>('/projectos', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async submeterDocumentoProjecto(id: number, anexoPath: string): Promise<ProjectoGet> {
    try {
      const { data } = await api.put<ProjectoGet>(`/projectos/${id}/documento`, { anexo_path: anexoPath });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async getEstagio(actividadeId: number): Promise<EstagioGet | null> {
    const { data } = await api.get<EstagioGet | null>(`/actividades/${actividadeId}/estagio`);
    return data;
  },
  async upsertEstagio(data: EstagioUpsert): Promise<EstagioGet> {
    try {
      const { data: result } = await api.post<EstagioGet>('/estagios', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async submeterDocumentoEstagio(id: number, anexoPath: string): Promise<EstagioGet> {
    try {
      const { data } = await api.put<EstagioGet>(`/estagios/${id}/documento`, { anexo_path: anexoPath });
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Técnicos (validador + assistente) ----
  async listTecnicos(actividadeId: number): Promise<ActividadeTecnicoGet[]> {
    const { data } = await api.get<ActividadeTecnicoGet[]>(`/actividades/${actividadeId}/tecnicos`);
    return data;
  },
  async addTecnico(data: ActividadeTecnicoUpsert): Promise<ActividadeTecnicoGet> {
    try {
      const { data: result } = await api.post<ActividadeTecnicoGet>('/actividade-tecnico', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeTecnico(id: number): Promise<void> {
    try {
      await api.delete(`/actividade-tecnico/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Materiais solicitados na atividade ----
  async listMateriais(actividadeId: number): Promise<ActividadeMaterialGet[]> {
    const { data } = await api.get<ActividadeMaterialGet[]>(`/actividades/${actividadeId}/materiais`);
    return data;
  },
  async addMaterial(data: ActividadeMaterialUpsert): Promise<ActividadeMaterialGet> {
    try {
      const { data: result } = await api.post<ActividadeMaterialGet>('/actividade-materiais', data);
      return result;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeMaterial(id: number): Promise<void> {
    try {
      await api.delete(`/actividade-materiais/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
