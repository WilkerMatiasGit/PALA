import { api, apiErrorMessage } from './api';
import type { CatalogoGet, CatalogoUpsert } from '@/types/catalogo.types';

export type CatalogoEndpoint = 'unidades-laboratoriais' | 'categorias-material' | 'unidades';

function factory(resource: CatalogoEndpoint) {
  return {
    list: async (): Promise<CatalogoGet[]> => {
      try {
        return (await api.get<CatalogoGet[]>(`/${resource}`)).data;
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      }
    },
    create: async (data: CatalogoUpsert): Promise<CatalogoGet> => {
      try {
        return (await api.post<CatalogoGet>(`/${resource}`, data)).data;
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      }
    },
    update: async (id: number, data: CatalogoUpsert): Promise<CatalogoGet> => {
      try {
        return (await api.put<CatalogoGet>(`/${resource}/${id}`, data)).data;
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      }
    },
    remove: async (id: number): Promise<void> => {
      try {
        await api.delete(`/${resource}/${id}`);
      } catch (err) {
        throw new Error(apiErrorMessage(err));
      }
    },
  };
}

export const unidadesLaboratoriaisService = factory('unidades-laboratoriais');
export const categoriasMaterialService = factory('categorias-material');
export const unidadesService = factory('unidades');
