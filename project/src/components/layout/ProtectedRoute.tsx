import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { UtilizadorTipo } from '@/services/enums';
import { hasRole } from '@/utils/roleGuard';
import { FullPageSpinner } from '@/components/ui/spinner';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UtilizadorTipo[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && !hasRole(user.tipo, allowedRoles)) {
    return <Navigate to="/inicio" replace />;
  }

  return <>{children}</>;
}
