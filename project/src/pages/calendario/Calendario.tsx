import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/ui/error-state';
import { FullPageSpinner } from '@/components/ui/spinner';
import { agendamentosService, type AgendamentoListFilters } from '@/services/agendamentos.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { MESES, DIAS_SEMANA } from '@/utils/constants';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import { format, startOfWeek, addDays, addWeeks, addMonths, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTime } from '@/utils/formatDate';
import { AlertTriangle, ChevronLeft, ChevronRight, Calendar as CalIcon, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalView = 'mes' | 'semana' | 'dia';

function dateKey(d: Date | string): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return format(date, 'yyyy-MM-dd');
}

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export default function Calendario() {
  const navigate = useNavigate();
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [labFilter, setLabFilter] = useState('all');
  const [view, setView] = useState<CalView>('mes');
  const [baseDate, setBaseDate] = useState<Date>(() => new Date());

  const weekStart = useMemo(() => startOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);

  const buildFilters = useMemo((): AgendamentoListFilters => {
    const lab = labFilter !== 'all' ? Number(labFilter) : undefined;
    if (view === 'mes') {
      return { laboratorio_id: lab, mes: baseDate.getMonth() + 1, ano: baseDate.getFullYear() };
    }
    if (view === 'semana') {
      return { laboratorio_id: lab, de: format(weekStart, 'yyyy-MM-dd'), ate: format(addDays(weekStart, 7), 'yyyy-MM-dd') };
    }
    const day = startOfDay(baseDate);
    return { laboratorio_id: lab, de: format(day, 'yyyy-MM-dd'), ate: format(addDays(day, 1), 'yyyy-MM-dd') };
  }, [labFilter, view, baseDate, weekStart]);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([
      laboratoriosService.list(),
      agendamentosService.list(buildFilters),
    ]).then(([l, a]) => { setLabs(l); setAgendamentos(a); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [buildFilters]);

  const agsByDate = useMemo(() => {
    const map: Record<string, AgendamentoGet[]> = {};
    for (const ag of agendamentos) {
      const k = dateKey(ag.hora_inicio);
      if (!map[k]) map[k] = [];
      map[k].push(ag);
    }
    return map;
  }, [agendamentos]);

  const choquesByDate = useMemo(() => {
    const set = new Set<string>();
    for (const [key, ags] of Object.entries(agsByDate)) {
      for (let i = 0; i < ags.length; i++) {
        for (let j = i + 1; j < ags.length; j++) {
          const a = ags[i]; const b = ags[j];
          if (a.laboratorio_id === b.laboratorio_id) {
            const aStart = new Date(a.hora_inicio).getTime();
            const aEnd = new Date(a.hora_fim).getTime();
            const bStart = new Date(b.hora_inicio).getTime();
            const bEnd = new Date(b.hora_fim).getTime();
            if (aStart < bEnd && bStart < aEnd) set.add(key);
          }
        }
      }
    }
    return set;
  }, [agsByDate]);

  const monthCells = useMemo(() => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const total = lastDay.getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(dateKey(new Date(year, month, d)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [baseDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const nav = (dir: 1 | -1) => {
    if (view === 'mes') setBaseDate((d) => addMonths(d, dir));
    else if (view === 'semana') setBaseDate((d) => addWeeks(d, dir));
    else setBaseDate((d) => addDays(d, dir));
  };

  const title =
    view === 'mes'
      ? `${MESES[baseDate.getMonth()]} ${baseDate.getFullYear()}`
      : view === 'semana'
        ? `${format(weekStart, "dd/MM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "dd/MM/yyyy", { locale: ptBR })}`
        : format(baseDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (loading) return <div><PageHeader title="Calendário" /><FullPageSpinner /></div>;
  if (error) return <div><PageHeader title="Calendário" /><ErrorState onRetry={load} /></div>;

  const renderCell = (key: string, isWeek = false) => {
    const dayAgs = agsByDate[key] ?? [];
    const hasChoque = choquesByDate.has(key);
    const dayNum = Number(key.slice(8, 10));
    return (
      <div key={key} className={cn('rounded-lg border p-1.5', isWeek && 'min-h-[100px]', !isWeek && 'min-h-[80px]', hasChoque && 'border-red-300 bg-red-50')}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium">{dayNum}</span>
          {hasChoque && <AlertTriangle className="h-3 w-3 text-red-500" />}
        </div>
        <div className="space-y-1">
          {dayAgs.slice(0, isWeek ? 4 : 3).map((ag) => (
            <button
              key={ag.id}
              onClick={() => navigate(`/actividades/${ag.actividade_id}`)}
              className="block w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[10px] text-primary hover:bg-primary/20"
            >
              {formatTime(ag.hora_inicio)} {ag.actividade_nome}
            </button>
          ))}
          {dayAgs.length > (isWeek ? 4 : 3) && <p className="text-[10px] text-muted-foreground">+{dayAgs.length - (isWeek ? 4 : 3)} mais</p>}
        </div>
      </div>
    );
  };

  const dayKey = dateKey(baseDate);
  const dayAgs = agsByDate[dayKey] ?? [];
  const dayHours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00–22:00

  return (
    <div>
      <PageHeader title="Calendário" description="Ocupação dos laboratórios — visão mensal, semanal ou diária." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={labFilter} onValueChange={setLabFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos os laboratórios" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os laboratórios</SelectItem>
            {labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={(v) => setView(v as CalView)}>
          <TabsList>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="dia">Dia</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[200px] text-center text-sm font-medium">{title}</span>
          <Button variant="outline" size="icon" onClick={() => nav(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setBaseDate(new Date())}>
          <Home className="mr-1.5 h-4 w-4" /> Hoje
        </Button>

        <input
          type="date"
          value={format(baseDate, 'yyyy-MM-dd')}
          onChange={(e) => { if (e.target.value) setBaseDate(parseDateInput(e.target.value)); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <Card className="p-4">
        {view === 'dia' ? (
          <div>
            {dayAgs.length === 0 && (
              <p className="mb-3 text-sm text-muted-foreground">Sem agendamentos neste dia.</p>
            )}
            <div className="space-y-1">
              {dayHours.map((h) => {
                const hStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h).getTime();
                const hEnd = hStart + 60 * 60 * 1000;
                const inHour = dayAgs.filter((ag) => {
                  const s = new Date(ag.hora_inicio).getTime();
                  const e = new Date(ag.hora_fim).getTime();
                  return s < hEnd && hStart < e;
                });
                return (
                  <div key={h} className="flex gap-3 border-t border-muted py-2">
                    <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{String(h).padStart(2, '0')}:00</span>
                    <div className="flex-1 space-y-1">
                      {inHour.map((ag) => (
                        <button
                          key={ag.id}
                          onClick={() => navigate(`/actividades/${ag.actividade_id}`)}
                          className="block w-full truncate rounded bg-primary/10 px-2 py-1 text-left text-xs text-primary hover:bg-primary/20"
                        >
                          {formatTime(ag.hora_inicio)}–{formatTime(ag.hora_fim)} · {ag.actividade_nome} · {ag.laboratorio_nome}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {view === 'mes'
                ? monthCells.map((key, i) => (key === null ? <div key={`e${i}`} className="min-h-[80px] rounded-lg bg-muted/30" /> : renderCell(key)))
                : weekDays.map((d) => renderCell(dateKey(d), true))}
            </div>
          </div>
        )}
      </Card>

      {agendamentos.length === 0 && view !== 'dia' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CalIcon className="h-4 w-4" /> Sem ocupação neste período.
        </div>
      )}
    </div>
  );
}