import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: 'stock' | 'info';
}

interface NotificacoesContextValue {
  notificacoes: Notificacao[];
  alertasCount: number;
  addNotificacao: (n: Omit<Notificacao, 'id'>) => void;
  clear: () => void;
}

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([
    { id: 1, titulo: 'Stock baixo', mensagem: 'Ácido Clorídrico (HCl) está abaixo do mínimo', tipo: 'stock' },
    { id: 2, titulo: 'Stock baixo', mensagem: 'Pipeta Graduada está abaixo do mínimo', tipo: 'stock' },
    { id: 3, titulo: 'Stock esgotado', mensagem: 'Sulfato de Cobre está esgotado', tipo: 'stock' },
  ]);

  const addNotificacao = useCallback((n: Omit<Notificacao, 'id'>) => {
    setNotificacoes((prev) => [...prev, { ...n, id: Date.now() }]);
  }, []);

  const clear = useCallback(() => setNotificacoes([]), []);

  return (
    <NotificacoesContext.Provider value={{ notificacoes, alertasCount: notificacoes.length, addNotificacao, clear }}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error('useNotificacoes must be used within NotificacoesProvider');
  return ctx;
}
