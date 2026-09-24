import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FiltersBar, type FilterField } from '@/components/ui/filters-bar';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DisciplinaUpsertModal } from '@/components/modal/DisciplinaUpsertModal';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { PAGE_SIZE } from '@/utils/constants';
import type { DisciplinaGet } from '@/types/disciplina.types';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';

export default function DisciplinasList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin']);
  const [disciplinas, setDisciplinas] = useState<DisciplinaGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplinaGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisciplinaGet | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true); setError(false);
    cursosService.listDisciplinas().then(setDisciplinas).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...disciplinas];
    if (filters.nome) result = result.filter((d) => d.nome.toLowerCase().includes(filters.nome.toLowerCase()));
    return result;
  }, [disciplinas, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar disciplina...' },
  ];

  return (
    <div>
      <PageHeader title="Disciplinas" description="Gestão de disciplinas." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova Disciplina</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={2} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={BookOpen} title="Sem disciplinas" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <DisciplinaUpsertModal open={modalOpen} onOpenChange={setModalOpen} disciplina={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover disciplina" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { cursosService.removeDisciplina(deleteTarget.id).then(() => { toast.success('Disciplina removida'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}