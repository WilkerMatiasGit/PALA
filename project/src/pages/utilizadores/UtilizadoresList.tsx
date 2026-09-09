import { useEffect, useState, useMemo } from 'react';
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
import { UtilizadorUpsertModal } from '@/components/modal/UtilizadorUpsertModal';
import { utilizadoresService } from '@/services/utilizadores.service';
import { UTILIZADOR_TIPO_LABELS, UTILIZADOR_TIPO_OPTIONS } from '@/services/enums';
import type { UtilizadorGet } from '@/types/utilizador.types';
import { PAGE_SIZE } from '@/utils/constants';
import { Plus, Pencil, KeyRound, Trash2, UserCog } from 'lucide-react';

export default function UtilizadoresList() {
  const [data, setData] = useState<UtilizadorGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UtilizadorGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UtilizadorGet | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    utilizadoresService.list().then((d) => setData(d)).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = [...data];
    if (filters.nome) result = result.filter((u) => u.nome.toLowerCase().includes(filters.nome.toLowerCase()));
    if (filters.email) result = result.filter((u) => u.email.toLowerCase().includes(filters.email.toLowerCase()));
    if (filters.tipo) result = result.filter((u) => u.tipo === filters.tipo);
    return result;
  }, [data, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Pesquisar nome...' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'Pesquisar email...' },
    { key: 'tipo', label: 'Tipo', type: 'select', options: UTILIZADOR_TIPO_OPTIONS },
  ];

  const handleEdit = (u: UtilizadorGet) => { setEditing(u); setModalOpen(true); };
  const handleNew = () => { setEditing(null); setModalOpen(true); };
  const handleResetPwd = (u: UtilizadorGet) => {
    const nova = window.prompt(`Repor a palavra-passe de "${u.nome}". Introduza a nova palavra-passe:`, '');
    if (nova === null) return; // cancelado
    utilizadoresService.resetPassword({ id: u.id, nova_senha: nova || '12345678' }).then(() => {
      toast.success(`Palavra-passe de ${u.nome} reposta`);
    }).catch(() => {
      toast.error('Erro ao repor a palavra-passe');
    });
  };
  const handleDelete = () => {
    if (!deleteTarget) return;
    utilizadoresService.remove(deleteTarget.id).then(() => {
      toast.success('Utilizador removido');
      setDeleteTarget(null);
      load();
    });
  };

  return (
    <div>
      <PageHeader title="Utilizadores" description="Gestão de utilizadores do sistema." action={
        <Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Novo Utilizador</Button>
      } />

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={4} /></div>
        ) : pageData.length === 0 ? (
          <EmptyState icon={UserCog} title="Sem utilizadores" description="Não existem utilizadores que correspondam aos filtros." action={<Button onClick={handleNew}><Plus className="mr-2 h-4 w-4" /> Novo Utilizador</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="secondary">{UTILIZADOR_TIPO_LABELS[u.tipo]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(u)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleResetPwd(u)} title="Repor senha"><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <UtilizadorUpsertModal open={modalOpen} onOpenChange={setModalOpen} utilizador={editing} onSaved={load} />

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remover utilizador" description={`Pretende remover ${deleteTarget?.nome}? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover" variant="destructive" onConfirm={handleDelete}
      />
    </div>
  );
}
