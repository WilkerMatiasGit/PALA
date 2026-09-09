import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { RelatorioUpsertModal } from '@/components/modal/RelatorioUpsertModal';
import { relatoriosService } from '@/services/relatorios.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { formatDate, monthLabel } from '@/utils/formatDate';
import type { RelatorioGet } from '@/types/relatorio.types';
import { Plus, ChevronRight, BarChart3 } from 'lucide-react';

export default function RelatoriosList() {
  const { user } = useAuth();
  const canCreate = hasRole(user?.tipo, ['admin', 'tecnico']);
  const navigate = useNavigate();
  const [data, setData] = useState<RelatorioGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    relatoriosService.list().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Relatórios" description="Relatórios de utilização dos laboratórios." action={
        canCreate ? <Button onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Gerar Relatório</Button> : undefined
      } />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={4} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={BarChart3} title="Sem relatórios" action={canCreate ? <Button onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Gerar Relatório</Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Laboratório</TableHead>
                <TableHead>Mês/Ano</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/relatorios/${r.id}`)}>
                  <TableCell className="font-medium">{r.laboratorio_nome}</TableCell>
                  <TableCell>{monthLabel(r.mes, r.ano)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.criado_por_nome}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.criado_em)}</TableCell>
                  <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RelatorioUpsertModal open={modalOpen} onOpenChange={setModalOpen} onSaved={load} />
    </div>
  );
}
