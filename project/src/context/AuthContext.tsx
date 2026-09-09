import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { authService } from '@/services/auth.service';
import { clearToken } from '@/services/api';
import type { AuthUser, LoginRequest } from '@/types/auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('dlab_user');
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (req: LoginRequest) => {
    setLoading(true);
    try {
      const res = await authService.login(req);
      setUser(res.user);
      localStorage.setItem('dlab_user', JSON.stringify(res.user));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    clearToken();
    localStorage.removeItem('dlab_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
