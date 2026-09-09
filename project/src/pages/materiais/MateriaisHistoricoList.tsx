import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FiltersBar, type FilterField } from '@/components/ui/filters-bar';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { HistoricoMaterialUpsertModal } from '@/components/modal/HistoricoMaterialUpsertModal';
import { movimentacoesService } from '@/services/movimentacoes.service';
import { materiaisService } from '@/services/materiais.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { MOVIMENTACAO_MOTIVO_OPTIONS, MOVIMENTACAO_MOTIVO_LABELS } from '@/services/enums';
import { formatDate } from '@/utils/formatDate';
import type { HistoricoMaterialGet, MaterialGet } from '@/types/material.types';
import { PAGE_SIZE } from '@/utils/constants';
import { Plus, History } from 'lucide-react';

export default function MateriaisHistoricoList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin', 'tecnico', 'supervisor', 'chefe_departamento']);
  const [data, setData] = useState<HistoricoMaterialGet[]>([]);
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [movOpen, setMovOpen] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([movimentacoesService.listAll(), materiaisService.list()])
      .then(([h, m]) => { setData(h); setMateriais(m); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.material_id) result = result.filter((h) => String(h.material_id) === filters.material_id);
    if (filters.motivo) result = result.filter((h) => h.motivo === filters.motivo);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'material_id', label: 'Material', type: 'select', options: materiais.map((m) => ({ value: String(m.id), label: m.nome })) },
    { key: 'motivo', label: 'Motivo', type: 'select', options: MOVIMENTACAO_MOTIVO_OPTIONS },
  ];

  return (
    <div>
      <PageHeader title="Histórico de Movimentações" description="Registo de todas as movimentações de stock." action={
        canEdit ? <Button disabled={materiais.length === 0} onClick={() => setMovOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova Movimentação</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={6} cols={5} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={History} title="Sem movimentações" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Utilizador</TableHead>
                <TableHead>Δ</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.material_nome}</TableCell>
                  <TableCell className="text-muted-foreground">{h.utilizador_nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={h.quantidade_movimentada >= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                      {h.quantidade_movimentada >= 0 ? '+' : ''}{h.quantidade_movimentada}
                    </Badge>
                  </TableCell>
                  <TableCell>{MOVIMENTACAO_MOTIVO_LABELS[h.motivo]}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(h.criado_em)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <HistoricoMaterialUpsertModal open={movOpen} onOpenChange={setMovOpen} material={null} onSaved={load} />
    </div>
  );
}
