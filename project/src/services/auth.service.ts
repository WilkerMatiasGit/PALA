import { api, setToken, clearToken, apiErrorMessage } from './api';
import type { LoginRequest, LoginResponse } from '@/types/auth.types';

export const authService = {
  // POST /user/login → { user, token }
  async login(req: LoginRequest): Promise<LoginResponse> {
    try {
      const { data } = await api.post<LoginResponse>('/user/login', req);
      setToken(data.token);
      return data;
    } catch (err) {
      throw new Error(apiErrorMessage(err));
    }
  },

  async logout(): Promise<void> {
    clearToken();
  },
};
