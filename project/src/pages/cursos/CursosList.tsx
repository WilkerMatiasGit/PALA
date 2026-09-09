import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CursoUpsertModal } from '@/components/modal/CursoUpsertModal';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { DEPARTAMENTO_LABELS } from '@/services/enums';
import type { CursoGet } from '@/types/curso.types';
import { Plus, Pencil, Trash2, GraduationCap } from 'lucide-react';

export default function CursosList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin']);
  const [data, setData] = useState<CursoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CursoGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CursoGet | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    cursosService.listCursos().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Cursos" description="Gestão de cursos e departamentos." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Curso</Button> : undefined
      } />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={3} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Sem cursos" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Abreviação</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="secondary">{DEPARTAMENTO_LABELS[c.departamento]}</Badge></TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.abreviacao}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

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
