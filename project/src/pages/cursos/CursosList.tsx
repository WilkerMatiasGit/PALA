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
import { CursoUpsertModal } from '@/components/modal/CursoUpsertModal';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { DEPARTAMENTO_LABELS } from '@/services/enums';
import { PAGE_SIZE } from '@/utils/constants';
import type { CursoGet } from '@/types/curso.types';
import { Plus, Pencil, Trash2, ChevronRight, GraduationCap } from 'lucide-react';

export default function CursosList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = hasRole(user?.tipo, ['admin']);
  const [data, setData] = useState<CursoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CursoGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CursoGet | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true); setError(false);
    cursosService.listCursos().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.nome) result = result.filter((c) => c.nome.toLowerCase().includes(filters.nome.toLowerCase()));
    if (filters.departamento) result = result.filter((c) => c.departamento === filters.departamento);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const departamentoOptions: FilterField['options'] = Object.entries(DEPARTAMENTO_LABELS).map(([value, label]) => ({ value, label }));

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar curso...' },
    { key: 'departamento', label: 'Departamento', type: 'select', options: departamentoOptions },
  ];

  return (
    <div>
      <PageHeader title="Cursos" description="Gestão de cursos e departamentos." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Curso</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={3} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Sem cursos" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Abreviação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/cursos/${c.id}`)}>
                  <TableCell><Badge variant="secondary">{DEPARTAMENTO_LABELS[c.departamento]}</Badge></TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.abreviacao}</TableCell>
                  <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/cursos/${c.id}`)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <CursoUpsertModal open={modalOpen} onOpenChange={setModalOpen} curso={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover curso" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { cursosService.removeCurso(deleteTarget.id).then(() => { toast.success('Curso removido'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}
