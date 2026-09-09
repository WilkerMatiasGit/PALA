import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor JWT: anexa o token a cada pedido autenticado
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de resposta: normaliza erros e despeja sessão em 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  }
);

export function getToken(): string | null {
  return localStorage.getItem('dlab_token');
}

export function setToken(token: string): void {
  localStorage.setItem('dlab_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('dlab_token');
}

// Extrai a mensagem de erro da API (devolve mensagem genérica se não houver)
export function apiErrorMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message ?? axiosErr?.message ?? 'Erro inesperado';
}
