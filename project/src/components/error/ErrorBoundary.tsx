import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Componente falhou:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Ocorreu um erro inesperado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A aplicação encontrou um problema ao renderizar esta página. Pode recarregar para voltar a tentar.
            </p>
            {this.state.error.message && (
              <pre className="mt-4 max-h-36 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
                {this.state.error.message}
              </pre>
            )}
            <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
              Recarregar a aplicação
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}