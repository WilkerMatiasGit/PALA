import { api, apiErrorMessage } from './api';
import type { CursoGet, CursoUpsert } from '@/types/curso.types';
import type { DisciplinaGet, DisciplinaUpsert, CursoDisciplinaGet, CursoDisciplinaUpsert } from '@/types/disciplina.types';
import type { EstudanteGet, EstudanteUpsert, EstudanteActividadeGet } from '@/types/estudantes.types';

export const cursosService = {
  // ---- Cursos ----
  async listCursos(): Promise<CursoGet[]> {
    const { data } = await api.get<CursoGet[]>('/cursos');
    return data;
  },
  async getCurso(id: number): Promise<CursoGet> {
    try {
      const { data } = await api.get<CursoGet>(`/cursos/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async createCurso(data: CursoUpsert): Promise<CursoGet> {
    try {
      const { data: created } = await api.post<CursoGet>('/cursos', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async updateCurso(id: number, data: CursoUpsert): Promise<CursoGet> {
    try {
      const { data: updated } = await api.put<CursoGet>(`/cursos/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeCurso(id: number): Promise<void> {
    try {
      await api.delete(`/cursos/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Disciplinas ----
  async listDisciplinas(): Promise<DisciplinaGet[]> {
    const { data } = await api.get<DisciplinaGet[]>('/disciplinas');
    return data;
  },
  async createDisciplina(data: DisciplinaUpsert): Promise<DisciplinaGet> {
    try {
      const { data: created } = await api.post<DisciplinaGet>('/disciplinas', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async updateDisciplina(id: number, data: DisciplinaUpsert): Promise<DisciplinaGet> {
    try {
      const { data: updated } = await api.put<DisciplinaGet>(`/disciplinas/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeDisciplina(id: number): Promise<void> {
    try {
      await api.delete(`/disciplinas/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Curso-Disciplinas ----
  async listCursoDisciplinas(cursoId?: number): Promise<CursoDisciplinaGet[]> {
    const { data } = await api.get<CursoDisciplinaGet[]>('/curso-disciplinas', {
      params: cursoId ? { curso_id: cursoId } : undefined,
    });
    return data;
  },
  async createCursoDisciplina(data: CursoDisciplinaUpsert): Promise<CursoDisciplinaGet> {
    try {
      const { data: created } = await api.post<CursoDisciplinaGet>('/curso-disciplinas', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeCursoDisciplina(id: number): Promise<void> {
    try {
      await api.delete(`/curso-disciplinas/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  // ---- Estudantes ----
  async listEstudantes(): Promise<EstudanteGet[]> {
    const { data } = await api.get<EstudanteGet[]>('/estudantes');
    return data;
  },
  async getEstudante(id: number): Promise<EstudanteGet> {
    try {
      const { data } = await api.get<EstudanteGet>(`/estudantes/${id}`);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async listEstudanteActividades(id: number): Promise<EstudanteActividadeGet[]> {
    const { data } = await api.get<EstudanteActividadeGet[]>(`/estudantes/${id}/actividades`);
    return data;
  },
  async createEstudante(data: EstudanteUpsert): Promise<EstudanteGet> {
    try {
      const { data: created } = await api.post<EstudanteGet>('/estudantes', data);
      return created;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async updateEstudante(id: number, data: EstudanteUpsert): Promise<EstudanteGet> {
    try {
      const { data: updated } = await api.put<EstudanteGet>(`/estudantes/${id}`, data);
      return updated;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
  async removeEstudante(id: number): Promise<void> {
    try {
      await api.delete(`/estudantes/${id}`);
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },
};
