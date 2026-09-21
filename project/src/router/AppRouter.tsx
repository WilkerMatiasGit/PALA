import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificacoesProvider } from '@/context/NotificacoesContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { FullPageSpinner } from '@/components/ui/spinner';
import { Toaster } from '@/components/ui/sonner';

const Login = lazy(() => import('@/pages/auth/Login'));
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'));
const Perfil = lazy(() => import('@/pages/utilizadores/Perfil'));
const UtilizadoresList = lazy(() => import('@/pages/utilizadores/UtilizadoresList'));
const LaboratoriosList = lazy(() => import('@/pages/laboratorios/LaboratoriosList'));
const LaboratorioDetalhe = lazy(() => import('@/pages/laboratorios/LaboratorioDetalhe'));
const CursosList = lazy(() => import('@/pages/cursos/CursosList'));
const DisciplinasList = lazy(() => import('@/pages/cursos/DisciplinasList'));
const EstudantesList = lazy(() => import('@/pages/estudantes/EstudantesList'));
const ActividadesList = lazy(() => import('@/pages/actividades/ActividadesList'));
const ActividadeDetalhe = lazy(() => import('@/pages/actividades/ActividadeDetalhe'));
const AprovacoesList = lazy(() => import('@/pages/aprovacoes/AprovacoesList'));
const AprovacaoDetalhe = lazy(() => import('@/pages/aprovacoes/AprovacaoDetalhe'));
const Calendario = lazy(() => import('@/pages/calendario/Calendario'));
const MateriaisList = lazy(() => import('@/pages/materiais/MateriaisList'));
const MateriaisHistoricoList = lazy(() => import('@/pages/materiais/MateriaisHistoricoList'));
const MaterialDetalhe = lazy(() => import('@/pages/materiais/MaterialDetalhe'));
const RelatoriosList = lazy(() => import('@/pages/relatorios/RelatoriosList'));
const RelatorioDetalhe = lazy(() => import('@/pages/relatorios/RelatorioDetalhe'));

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/inicio" replace /> : (
        <AuthLayout><Login /></AuthLayout>
      )} />

      <Route element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><div /></Suspense></AppShell></ProtectedRoute>}>
        {/* placeholder for layout-wrapped routes */}
      </Route>

      <Route path="/inicio" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><Dashboard /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><Perfil /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><AppShell><Suspense fallback={<FullPageSpinner />}><UtilizadoresList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/labs" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><LaboratoriosList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/labs/:id" element={<ProtectedRoute allowedRoles={['admin','tecnico','coordenador_dlab','supervisor','chefe_departamento']}><AppShell><Suspense fallback={<FullPageSpinner />}><LaboratorioDetalhe /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/cursos" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><CursosList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/disciplinas" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><DisciplinasList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/estudantes" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><EstudantesList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/actividades" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><ActividadesList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/actividades/:id" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><ActividadeDetalhe /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/aprovacoes" element={<ProtectedRoute allowedRoles={['admin','coordenador_dlab','supervisor','chefe_departamento']}><AppShell><Suspense fallback={<FullPageSpinner />}><AprovacoesList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/aprovacoes/:id" element={<ProtectedRoute allowedRoles={['admin','coordenador_dlab','supervisor']}><AppShell><Suspense fallback={<FullPageSpinner />}><AprovacaoDetalhe /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/calendario" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><Calendario /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/materiais" element={<ProtectedRoute allowedRoles={['admin','tecnico','coordenador_dlab','supervisor','chefe_departamento']}><AppShell><Suspense fallback={<FullPageSpinner />}><MateriaisList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/materiais/historico" element={<ProtectedRoute allowedRoles={['admin','tecnico','supervisor','chefe_departamento']}><AppShell><Suspense fallback={<FullPageSpinner />}><MateriaisHistoricoList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/materiais/:id" element={<ProtectedRoute allowedRoles={['admin','tecnico','coordenador_dlab','supervisor','chefe_departamento']}><AppShell><Suspense fallback={<FullPageSpinner />}><MaterialDetalhe /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><RelatoriosList /></Suspense></AppShell></ProtectedRoute>} />
      <Route path="/relatorios/:id" element={<ProtectedRoute><AppShell><Suspense fallback={<FullPageSpinner />}><RelatorioDetalhe /></Suspense></AppShell></ProtectedRoute>} />

      <Route path="*" element={<Navigate to={user ? "/inicio" : "/"} replace />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificacoesProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
          <Toaster />
        </NotificacoesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
