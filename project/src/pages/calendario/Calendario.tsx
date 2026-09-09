import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FullPageSpinner } from '@/components/ui/spinner';
import { agendamentosService } from '@/services/agendamentos.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { formatTipo } from '@/utils/formatEstado';
import { MESES, DIAS_SEMANA } from '@/utils/constants';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import { formatTime } from '@/utils/formatDate';
import { AlertTriangle, ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Calendario() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [labFilter, setLabFilter] = useState('all');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1)); // June 2026

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([
      laboratoriosService.list(),
      agendamentosService.list({
        laboratorio_id: labFilter !== 'all' ? Number(labFilter) : undefined,
        mes: currentDate.getMonth() + 1,
        ano: currentDate.getFullYear(),
      }),
    ]).then(([l, a]) => { setLabs(l); setAgendamentos(a); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [labFilter, currentDate]);

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const total = lastDay.getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentDate]);

  const agsByDay = useMemo(() => {
    const map: Record<number, AgendamentoGet[]> = {};
    for (const ag of agendamentos) {
      const d = new Date(ag.hora_inicio).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(ag);
    }
    return map;
  }, [agendamentos]);

  const choques = useMemo(() => {
    const set = new Set<number>();
    for (const [day, ags] of Object.entries(agsByDay)) {
      for (let i = 0; i < ags.length; i++) {
        for (let j = i + 1; j < ags.length; j++) {
          const a = ags[i]; const b = ags[j];
          if (a.laboratorio_id === b.laboratorio_id) {
            const aStart = new Date(a.hora_inicio).getTime();
            const aEnd = new Date(a.hora_fim).getTime();
            const bStart = new Date(b.hora_inicio).getTime();
            const bEnd = new Date(b.hora_fim).getTime();
            if (aStart < bEnd && bStart < aEnd) set.add(Number(day));
          }
        }
      }
    }
    return set;
  }, [agsByDay]);

  if (loading) return <div><PageHeader title="Calendário" /><FullPageSpinner /></div>;
  if (error) return <div><PageHeader title="Calendário" /><ErrorState onRetry={load} /></div>;

  return (
    <div>
      <PageHeader title="Calendário" description="Ocupação mensal dos laboratórios." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={labFilter} onValueChange={setLabFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos os laboratórios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os laboratórios</SelectItem>
            {labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">{MESES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {agendamentos.length === 0 ? (
          <EmptyState icon={CalIcon} title="Sem ocupação" description="Não há agendamentos aprovados para este período." />
        ) : (
          <div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {daysInMonth.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-[80px] rounded-lg bg-muted/30" />;
                const dayAgs = agsByDay[day] ?? [];
                const hasChoque = choques.has(day);
                return (
                  <div key={i} className={cn('min-h-[80px] rounded-lg border p-1.5', hasChoque && 'border-red-300 bg-red-50')}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium">{day}</span>
                      {hasChoque && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>
                    <div className="space-y-1">
                      {dayAgs.slice(0, 3).map((ag) => (
                        <button
                          key={ag.id}
                          onClick={() => navigate(`/actividades/${ag.actividade_id}`)}
                          className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] text-primary hover:bg-primary/20"
                        >
                          {formatTime(ag.hora_inicio)} {ag.actividade_nome}
                        </button>
                      ))}
                      {dayAgs.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayAgs.length - 3} mais</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
