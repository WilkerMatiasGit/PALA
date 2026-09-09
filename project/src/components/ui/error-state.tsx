import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Algo correu mal', message = 'Ocorreu um erro ao carregar os dados. Tente novamente.', onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-sm font-medium underline">
            Tentar novamente
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
