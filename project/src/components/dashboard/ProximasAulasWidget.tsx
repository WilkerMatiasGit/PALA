import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { AgendamentoGet } from '@/types/agendamento.types';
import { CalendarClock, ChevronRight } from 'lucide-react';

export function ProximasAulasWidget({ agendamentos, loading }: { agendamentos: AgendamentoGet[]; loading: boolean }) {
  const navigate = useNavigate();
  const now = new Date();
  const proximos = agendamentos
    .filter((a) => new Date(a.hora_inicio) >= now)
    .sort((a, b) => new Date(a.hora_inicio).getTime() - new Date(b.hora_inicio).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Próximos Agendamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : proximos.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Sem agendamentos próximos" />
        ) : (
          <div className="space-y-2">
            {proximos.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/actividades/${a.actividade_id}`)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-medium">{a.actividade_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.hora_inicio)} · {formatTime(a.hora_inicio)} - {formatTime(a.hora_fim)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
