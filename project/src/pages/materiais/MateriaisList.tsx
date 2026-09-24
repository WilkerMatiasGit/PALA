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
import { StockAlertBadge } from '@/components/ui/stock-alert-badge';
import { MaterialUpsertModal } from '@/components/modal/MaterialUpsertModal';
import { HistoricoMaterialUpsertModal } from '@/components/modal/HistoricoMaterialUpsertModal';
import { materiaisService } from '@/services/materiais.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { MATERIAL_ESTADO_OPTIONS } from '@/services/enums';
import { catalogoLabel } from '@/utils/catalogo';
import { formatMaterialEstado } from '@/utils/formatEstado';
import { categoriasMaterialService } from '@/services/catalogos.service';
import type { MaterialGet } from '@/types/material.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import { PAGE_SIZE } from '@/utils/constants';
import { Plus, Pencil, Trash2, ChevronRight, Minus, Package } from 'lucide-react';

export default function MateriaisList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento']);
  const canMov = hasRole(user?.tipo, ['admin', 'tecnico', 'supervisor', 'chefe_departamento']);
  const navigate = useNavigate();
  const [data, setData] = useState<MaterialGet[]>([]);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [categorias, setCategorias] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialGet | null>(null);
  const [movTarget, setMovTarget] = useState<MaterialGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialGet | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([materiaisService.list(), laboratoriosService.list(), categoriasMaterialService.list()])
      .then(([m, l, c]) => { setData(m); setLabs(l); setCategorias(c.map((cat) => ({ value: cat.nome, label: catalogoLabel(cat.nome) }))); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.nome) {
      const q = filters.nome.toLowerCase();
      result = result.filter((m) => m.nome.toLowerCase().includes(q));
    }
    if (filters.lab) result = result.filter((m) => String(m.laboratorio_id) === filters.lab);
    if (filters.categoria) result = result.filter((m) => m.categoria === filters.categoria);
    if (filters.estado) result = result.filter((m) => m.estado === filters.estado);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar...' },
    { key: 'lab', label: 'Laboratório', type: 'select', options: labs.map((l) => ({ value: String(l.id), label: l.nome })) },
    { key: 'categoria', label: 'Categoria', type: 'select', options: categorias },
    { key: 'estado', label: 'Estado', type: 'select', options: MATERIAL_ESTADO_OPTIONS },
  ];

  return (
    <div>
      <PageHeader title="Materiais" description="Gestão de inventário por laboratório." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Material</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={6} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={Package} title="Sem materiais" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Mín</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((m) => {
                const est = formatMaterialEstado(m.estado);
                const lowStock = m.quantidade <= m.quantidade_minima;
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/materiais/${m.id}`)}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell><Badge variant="secondary">{catalogoLabel(m.categoria)}</Badge></TableCell>
                    <TableCell>
                      <span className={lowStock ? 'font-bold text-red-600' : ''}>{m.quantidade} {m.unidade}</span>
                      {lowStock && <StockAlertBadge quantidade={m.quantidade} minima={m.quantidade_minima} className="ml-1" />}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.quantidade_minima}</TableCell>
                    <TableCell><Badge variant="outline" className={est.className}>{est.label}</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canMov && <Button variant="ghost" size="icon" onClick={() => setMovTarget(m)} title="Movimentar stock"><Minus className="h-4 w-4" /></Button>}
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/materiais/${m.id}`)}><ChevronRight className="h-4 w-4" /></Button>
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

      <MaterialUpsertModal open={modalOpen} onOpenChange={setModalOpen} material={editing} onSaved={load} />
      <HistoricoMaterialUpsertModal open={!!movTarget} onOpenChange={(v) => !v && setMovTarget(null)} material={movTarget} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover material" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { materiaisService.remove(deleteTarget.id).then(() => { toast.success('Material removido'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}
