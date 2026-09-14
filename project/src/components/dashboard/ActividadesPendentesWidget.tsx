import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatEstado } from '@/utils/formatEstado';
import type { ActividadeGet } from '@/types/actividade.types';
import { ClipboardList, ChevronRight } from 'lucide-react';

export function ActividadesPendentesWidget({ actividades, loading, hideViewAll = false }: { actividades: ActividadeGet[]; loading: boolean; hideViewAll?: boolean }) {
  const navigate = useNavigate();
  const pendentes = actividades.filter(
    (a) => a.estado === 'pendente' || a.estado === 'revisado_dlab'
  ).slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Actividades Pendentes</CardTitle>
        {!hideViewAll && (
          <button onClick={() => navigate('/aprovacoes')} className="text-xs text-primary hover:underline">
            Ver todas
          </button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : pendentes.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sem actividades pendentes" />
        ) : (
          <div className="space-y-2">
            {pendentes.map((a) => {
              const est = formatEstado(a.estado);
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/actividades/${a.id}`)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.laboratorio_nome}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={est.className}>{est.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
