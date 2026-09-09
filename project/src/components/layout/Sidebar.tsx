import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, CheckCircle, Calendar, Package,
  History, BarChart3, FlaskConical, GraduationCap, BookOpen, Users, UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { SIDEBAR_SECTIONS } from '@/utils/roleGuard';
import { hasRole } from '@/utils/roleGuard';
import { APP_NAME } from '@/utils/constants';
import { FlaskConical as Logo } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ClipboardList, CheckCircle, Calendar, Package,
  History, BarChart3, FlaskConical, GraduationCap, BookOpen, Users, UserCog,
};

// Item ativo só se a rota coincide exatamente OU é uma página de detalhe (:id numérico).
// Evita que /materiais/historico (sub-página nomeada) acenda simultaneamente /materiais.
function isItemActive(itemPath: string, pathname: string): boolean {
  if (itemPath === pathname) return true;
  if (!pathname.startsWith(itemPath + '/')) return false;
  const firstSeg = pathname.slice(itemPath.length + 1).split('/')[0];
  return /^\d+$/.test(firstSeg);
}

export function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Logo className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold leading-none">{APP_NAME}</p>
          <p className="text-xs text-muted-foreground">Gestão de Laboratórios</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {SIDEBAR_SECTIONS.map((section) => {
          const items = section.items.filter((item) => hasRole(user?.tipo, item.roles));
          if (items.length === 0) return null;
          return (
            <div key={section.label} className="mb-6">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? ClipboardList;
                  const active = isItemActive(item.path, location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={() => navigate('/perfil')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {user?.nome.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-medium leading-none">{user?.nome}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
