import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FiltersBar, type FilterField } from '@/components/ui/filters-bar';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActividadeUpsertModal } from '@/components/modal/ActividadeUpsertModal';
import { actividadesService } from '@/services/actividades.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { ACTIVIDADE_TIPO_OPTIONS, ACTIVIDADE_ESTADO_LABELS } from '@/services/enums';
import { formatEstado, formatTipo } from '@/utils/formatEstado';
import type { ActividadeGet } from '@/types/actividade.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import type { ActividadeEstado } from '@/services/enums';
import { PAGE_SIZE } from '@/utils/constants';
import { Plus, Pencil, Trash2, ChevronRight, ClipboardList } from 'lucide-react';

const ESTADO_OPTIONS = (Object.keys(ACTIVIDADE_ESTADO_LABELS) as ActividadeEstado[]).map((k) => ({
  value: k, label: ACTIVIDADE_ESTADO_LABELS[k],
}));

export default function ActividadesList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin', 'professor', 'coordenador_dlab', 'supervisor', 'chefe_departamento']);
  const navigate = useNavigate();
  const [data, setData] = useState<ActividadeGet[]>([]);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActividadeGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActividadeGet | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([actividadesService.list(), laboratoriosService.list()])
      .then(([a, l]) => { setData(a); setLabs(l); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.nome) {
      const q = filters.nome.toLowerCase();
      result = result.filter((a) => a.nome.toLowerCase().includes(q));
    }
    if (filters.tipo) result = result.filter((a) => a.tipo === filters.tipo);
    if (filters.estado) result = result.filter((a) => a.estado === filters.estado);
    if (filters.lab) result = result.filter((a) => String(a.laboratorio_id) === filters.lab);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar...' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: ACTIVIDADE_TIPO_OPTIONS },
    { key: 'estado', label: 'Estado', type: 'select', options: ESTADO_OPTIONS },
    { key: 'lab', label: 'Laboratório', type: 'select', options: labs.map((l) => ({ value: String(l.id), label: l.nome })) },
  ];

  return (
    <div>
      <PageHeader title="Actividades" description="Gestão de actividades dos laboratórios." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova Actividade</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={5} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sem actividades" action={canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova Actividade</Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Laboratório</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((a) => {
                const est = formatEstado(a.estado);
                const tipo = formatTipo(a.tipo);
                return (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/actividades/${a.id}`)}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell><Badge variant="outline" className={tipo.className}>{tipo.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{a.laboratorio_nome}</TableCell>
                    <TableCell><Badge variant="outline" className={est.className}>{est.label}</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/actividades/${a.id}`)}><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ActividadeUpsertModal open={modalOpen} onOpenChange={setModalOpen} actividade={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover actividade" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { actividadesService.remove(deleteTarget.id).then(() => { toast.success('Actividade removida'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}
