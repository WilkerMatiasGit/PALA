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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LaboratorioUpsertModal } from '@/components/modal/LaboratorioUpsertModal';
import { laboratoriosService } from '@/services/laboratorios.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { LABORATORIO_TIPO_LABELS } from '@/services/enums';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import { Plus, Pencil, Trash2, ChevronRight, FlaskConical } from 'lucide-react';

export default function LaboratoriosList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin']);
  const canViewDetalhe = hasRole(user?.tipo, ['admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento']);
  const navigate = useNavigate();
  const [data, setData] = useState<LaboratorioGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LaboratorioGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LaboratorioGet | null>(null);

  const load = () => {
    setLoading(true); setError(false);
    laboratoriosService.list().then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader title="Laboratórios" description="Gestão de laboratórios." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo Laboratório</Button> : undefined
      } />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={3} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Sem laboratórios" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade Laboratorial</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((lab) => (
                <TableRow key={lab.id} className={canViewDetalhe ? 'cursor-pointer' : ''} onClick={() => canViewDetalhe && navigate(`/labs/${lab.id}`)}>
                  <TableCell className="font-medium">{lab.nome}</TableCell>
                  <TableCell><Badge variant="secondary">{LABORATORIO_TIPO_LABELS[lab.tipo]}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{lab.descricao}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(lab); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                      {canEdit && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(lab)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      {canViewDetalhe && <Button variant="ghost" size="icon" onClick={() => navigate(`/labs/${lab.id}`)}><ChevronRight className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <LaboratorioUpsertModal open={modalOpen} onOpenChange={setModalOpen} laboratorio={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover laboratório" description={`Pretende remover ${deleteTarget?.nome}?`}
        confirmLabel="Remover" variant="destructive"
        onConfirm={() => { if (deleteTarget) { laboratoriosService.remove(deleteTarget.id).then(() => { toast.success('Laboratório removido'); setDeleteTarget(null); load(); }); } }}
      />
    </div>
  );
}
