import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { laboratoriosService } from '@/services/laboratorios.service';
import { materiaisService } from '@/services/materiais.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { LABORATORIO_TIPO_LABELS } from '@/services/enums';
import { formatDate, formatTime } from '@/utils/formatDate';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import type { MaterialGet } from '@/types/material.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import { Package, CalendarClock, FlaskConical } from 'lucide-react';

export default function LaboratorioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lab, setLab] = useState<LaboratorioGet | null>(null);
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    if (!id) return;
    const labId = Number(id);
    setLoading(true); setError(false);
    Promise.all([
      laboratoriosService.get(labId),
      materiaisService.list({ laboratorio_id: labId }),
      agendamentosService.list({ laboratorio_id: labId }),
    ]).then(([l, m, a]) => {
      setLab(l); setMateriais(m); setAgendamentos(a);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !lab) return <ErrorState onRetry={load} />;

  const futuros = agendamentos.filter((a) => new Date(a.hora_inicio) >= new Date()).slice(0, 10);

  return (
    <div>
      <PageHeader
        title={lab.nome}
        breadcrumbs={[{ label: 'Laboratórios', href: '/labs' }, { label: lab.nome }]}
        action={<Badge variant="secondary">{LABORATORIO_TIPO_LABELS[lab.tipo]}</Badge>}
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">{lab.descricao}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Materiais deste Laboratório</CardTitle>
          </CardHeader>
          <CardContent>
            {materiais.length === 0 ? (
              <EmptyState icon={Package} title="Sem materiais" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiais.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/materiais/${m.id}`)}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>{m.quantidade} {m.unidade}</TableCell>
                      <TableCell><Badge variant="outline">{m.estado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" /> Agendamentos Futuros</CardTitle>
          </CardHeader>
          <CardContent>
            {futuros.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Sem agendamentos futuros" />
            ) : (
              <div className="space-y-2">
                {futuros.map((a) => (
                  <button key={a.id} onClick={() => navigate(`/actividades/${a.actividade_id}`)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
                    <div>
                      <p className="text-sm font-medium">{a.actividade_nome}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.hora_inicio)} · {formatTime(a.hora_inicio)} - {formatTime(a.hora_fim)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
