import { useNavigate } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificacoes } from '@/context/NotificacoesContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UTILIZADOR_TIPO_LABELS } from '@/services/enums';
import { formatDate } from '@/utils/formatDate';

export function Topbar() {
  const { user, logout } = useAuth();
  const { notificacoes, alertasCount } = useNotificacoes();
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <p className="text-sm text-muted-foreground">{greeting},</p>
        <p className="text-lg font-semibold">{user?.nome}</p>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {alertasCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">
                  {alertasCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Alertas de Stock</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notificacoes.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">Sem alertas</p>
            ) : (
              notificacoes.map((n) => (
                <DropdownMenuItem key={n.id} className="flex-col items-start">
                  <p className="text-sm font-medium">{n.titulo}</p>
                  <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {user?.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium leading-none">{user?.nome}</p>
            <p className="text-xs text-muted-foreground">{user ? UTILIZADOR_TIPO_LABELS[user.tipo] : ''}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={logout} title="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
