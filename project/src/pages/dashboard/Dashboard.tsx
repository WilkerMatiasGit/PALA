import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActividadesPendentesWidget } from '@/components/dashboard/ActividadesPendentesWidget';
import { StockAlertsWidget } from '@/components/dashboard/StockAlertsWidget';
import { ProximasAulasWidget } from '@/components/dashboard/ProximasAulasWidget';
import { ErrorState } from '@/components/ui/error-state';
import { actividadesService } from '@/services/actividades.service';
import { materiaisService } from '@/services/materiais.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { useAuth } from '@/context/AuthContext';
import type { ActividadeGet } from '@/types/actividade.types';
import type { MaterialGet } from '@/types/material.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import { Clock, CheckCircle2, AlertTriangle, CalendarDays } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [actividades, setActividades] = useState<ActividadeGet[]>([]);
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    // Professor não tem acesso a materiais (403) → não faz essa chamada.
    const isProf = user?.tipo === 'professor';
    Promise.all([
      actividadesService.list(),
      agendamentosService.list(),
      isProf ? Promise.resolve([] as MaterialGet[]) : materiaisService.list(),
    ]).then(([acts, ags, mats]) => {
      setActividades(acts);
      setMateriais(mats);
      // Professor/Técnico só veem os agendamentos das atividades em que estão envolvidos
      // (o backend já filtra a lista de atividades; aqui filtramos a de agendamentos).
      const limited = user?.tipo === 'professor' || user?.tipo === 'tecnico';
      const ids = new Set(acts.map((a) => a.id));
      setAgendamentos(limited ? ags.filter((g) => ids.has(g.actividade_id)) : ags);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const pendentes = actividades.filter((a) => a.estado === 'pendente' || a.estado === 'revisado_dlab').length;
  const aprovadas = actividades.filter((a) => a.estado === 'revisado_supervisor').length;
  const stockAlerts = materiais.filter((m) => m.quantidade <= m.quantidade_minima).length;
  const hoje = agendamentos.filter((a) => {
    const d = new Date(a.hora_inicio);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div>
      <PageHeader title="Início" description={`Bem-vindo ao sistema de gestão de laboratórios, ${user?.nome}.`} />

      {error ? (
        <ErrorState onRetry={load} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Clock} label="Pendentes" value={pendentes} color="amber" />
            <StatCard icon={CheckCircle2} label="Aprovadas" value={aprovadas} color="emerald" />
            {user?.tipo !== 'professor' && (
              <StatCard icon={AlertTriangle} label="Alertas de Stock" value={stockAlerts} color="red" />
            )}
            <StatCard icon={CalendarDays} label="Agendamentos Hoje" value={hoje} color="blue" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ActividadesPendentesWidget actividades={actividades} loading={loading} hideViewAll={user?.tipo === 'professor'} />
            {user?.tipo !== 'professor' && <StockAlertsWidget materiais={materiais} loading={loading} />}
          </div>

          <div className="mt-6">
            <ProximasAulasWidget agendamentos={agendamentos} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}
