import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { EstudanteUpsertModal } from '@/components/modal/EstudanteUpsertModal';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import type { EstudanteGet } from '@/types/estudantes.types';
import type { CursoGet } from '@/types/curso.types';
import { PAGE_SIZE } from '@/utils/constants';
import { Plus, Pencil, Trash2, ChevronRight, Users } from 'lucide-react';

export default function EstudantesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = hasRole(user?.tipo, ['admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento']);
  const [data, setData] = useState<EstudanteGet[]>([]);
  const [cursos, setCursos] = useState<CursoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstudanteGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EstudanteGet | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([cursosService.listEstudantes(), cursosService.listCursos()])
      .then(([e, c]) => { setData(e); setCursos(c); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.nome) result = result.filter((e) => e.nome.toLowerCase().includes(filters.nome.toLowerCase()));
    if (filters.curso) result = result.filter((e) => String(e.curso_id) === filters.curso);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar...' },
    { key: 'curso', label: 'Curso', type: 'select', options: cursos.map((c) => ({ value: String(c.id), label: c.nome })) },
  ];

  return (
    <div>
      <PageHeader title="Estudantes" description="Gestão de estudantes matriculados." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Estudante</Button> : undefined
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={3} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={Users} title="Sem estudantes" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Matrícula</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/estudantes/${e.id}`)}>
                  <TableCell className="font-mono text-muted-foreground">{e.id}</TableCell>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell>{e.curso_nome}</TableCell>
                  <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/estudantes/${e.id}`)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <EstudanteUpsertModal open={modalOpen} onOpenChange={setModalOpen} estudante={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover estudante" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { cursosService.removeEstudante(deleteTarget.id).then(() => { toast.success('Estudante removido'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}
