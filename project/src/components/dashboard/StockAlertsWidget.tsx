import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { MaterialGet } from '@/types/material.types';

export function StockAlertsWidget({ materiais, loading }: { materiais: MaterialGet[]; loading: boolean }) {
  const navigate = useNavigate();
  const alertas = materiais.filter((m) => m.quantidade <= m.quantidade_minima).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          Alertas de Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : alertas.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="Sem alertas" description="Todos os materiais têm stock suficiente." />
        ) : (
          <div className="space-y-2">
            {alertas.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/materiais/${m.id}`)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
              >
                <div>
                  <p className="text-sm font-medium">{m.nome}</p>
                  <p className="text-xs text-muted-foreground">{m.laboratorio_nome}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                    {m.quantidade} {m.unidade}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
