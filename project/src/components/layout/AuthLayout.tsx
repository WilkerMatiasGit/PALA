import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import { APP_FULL_NAME } from '@/utils/constants';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent via-background to-secondary p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <FlaskConical className="h-8 w-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">DLab</h1>
            <p className="text-sm text-muted-foreground">{APP_FULL_NAME}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
