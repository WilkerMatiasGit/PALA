import { api } from './api';
import type { CatalogoGet, CatalogoUpsert } from '@/types/catalogo.types';

export type CatalogoEndpoint = 'unidades-laboratoriais' | 'categorias-material' | 'unidades';

function factory(resource: CatalogoEndpoint) {
  return {
    list: async (): Promise<CatalogoGet[]> => (await api.get<CatalogoGet[]>(`/${resource}`)).data,
    create: async (data: CatalogoUpsert): Promise<CatalogoGet> => (await api.post<CatalogoGet>(`/${resource}`, data)).data,
    update: async (id: number, data: CatalogoUpsert): Promise<CatalogoGet> => (
      await api.put<CatalogoGet>(`/${resource}/${id}`, data)
    ).data,
    remove: async (id: number): Promise<void> => {
      await api.delete(`/${resource}/${id}`);
    },
  };
}

export const unidadesLaboratoriaisService = factory('unidades-laboratoriais');
export const categoriasMaterialService = factory('categorias-material');
export const unidadesService = factory('unidades');