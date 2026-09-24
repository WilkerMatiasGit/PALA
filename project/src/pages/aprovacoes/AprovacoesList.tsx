import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FiltersBar, type FilterField } from '@/components/ui/filters-bar';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { aprovacoesService } from '@/services/aprovacoes.service';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/utils/formatDate';
import { PAGE_SIZE } from '@/utils/constants';
import type { AprovacaoGet } from '@/types/aprovacao.types';
import { CheckCircle, ChevronRight } from 'lucide-react';

export default function AprovacoesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AprovacaoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true); setError(false);
    aprovacoesService.listFila().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user?.tipo]);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.actividade) {
      const q = filters.actividade.toLowerCase();
      result = result.filter((a) => (a.actividade_nome ?? '').toLowerCase().includes(q));
    }
    if (filters.etapa) result = result.filter((a) => a.etapa === filters.etapa);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'actividade', label: 'Actividade', type: 'text', placeholder: 'Pesquisar...' },
    { key: 'etapa', label: 'Etapa', type: 'select', options: [{ value: 'dlab', label: 'DLab' }, { value: 'supervisor', label: 'Supervisor' }] },
  ];

  const isAdmin = user?.tipo === 'admin';
  const title = isAdmin
    ? 'Fila de Aprovação - Admin'
    : user?.tipo === 'supervisor'
      ? 'Fila de Aprovação - Supervisor'
      : 'Fila de Aprovação - Coordenador DLab';
  const description = isAdmin
    ? 'Actividades pendentes (revisão DLab) e aprovadas pelo DLab (revisão Supervisor) que aguardam decisão.'
    : user?.tipo === 'supervisor'
      ? 'Actividades aprovadas pelo DLab que aguardam a sua validação final.'
      : 'Actividades pendentes que aguardam a sua validação técnica.';

  return (
    <div>
      <PageHeader title={title} description={description} />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={4} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={CheckCircle} title="Nada para aprovar" description="Não existem actividades na sua fila de aprovação neste momento." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actividade</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Data de submissão</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((a) => (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/aprovacoes/${a.id}`)}>
                  <TableCell className="font-medium">{a.actividade_nome}</TableCell>
                  <TableCell><Badge variant="secondary">{a.etapa === 'dlab' ? 'DLab' : 'Supervisor'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.criado_em)}</TableCell>
                  <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
