import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DisciplinaUpsertModal } from '@/components/modal/DisciplinaUpsertModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import type { DisciplinaGet, CursoDisciplinaGet } from '@/types/disciplina.types';
import type { CursoGet } from '@/types/curso.types';
import { semestreToAno, semestreNoAno, anoSemestreToSemestre } from '@/utils/constants';
import { Plus, Pencil, Trash2, BookOpen, Link2 } from 'lucide-react';

export default function DisciplinasList() {
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin']);
  const [disciplinas, setDisciplinas] = useState<DisciplinaGet[]>([]);
  const [cursos, setCursos] = useState<CursoGet[]>([]);
  const [cursoDisciplinas, setCursoDisciplinas] = useState<CursoDisciplinaGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DisciplinaGet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisciplinaGet | null>(null);

  // Association form
  const [assocCurso, setAssocCurso] = useState('');
  const [assocDisciplina, setAssocDisciplina] = useState('');
  const [assocAno, setAssocAno] = useState('1');
  const [assocSemNoAno, setAssocSemNoAno] = useState('1');

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([
      cursosService.listDisciplinas(),
      cursosService.listCursos(),
      cursosService.listCursoDisciplinas(),
    ]).then(([d, c, cd]) => {
      setDisciplinas(d); setCursos(c); setCursoDisciplinas(cd);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAssociate = async () => {
    if (!assocCurso || !assocDisciplina) { toast.error('Selecione curso e disciplina'); return; }
    if (cursoDisciplinas.some((cd) => cd.curso_id === Number(assocCurso) && cd.disciplina_id === Number(assocDisciplina))) {
      toast.error('Esta disciplina já está associada a este curso');
      return;
    }
    try {
      await cursosService.createCursoDisciplina({
        curso_id: Number(assocCurso),
        disciplina_id: Number(assocDisciplina),
        semestre: anoSemestreToSemestre(Number(assocAno), Number(assocSemNoAno)),
      });
      toast.success('Disciplina associada ao curso');
      setAssocCurso(''); setAssocDisciplina(''); setAssocAno('1'); setAssocSemNoAno('1');
      load();
    } catch {
      toast.error('Erro ao associar');
    }
  };

  return (
    <div>
      <PageHeader title="Disciplinas" description="Gestão de disciplinas e associações a cursos." action={
        canEdit ? <Button onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nova Disciplina</Button> : undefined
      } />

      <Card className="mb-6 p-0">
        {error ? (
          <div className="p-4"><ErrorState onRetry={load} /></div>
        ) : loading ? (
          <div className="p-4"><TableSkeleton rows={4} cols={2} /></div>
        ) : disciplinas.length === 0 ? (
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
              {disciplinas.map((d) => (
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

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" /> Associação Curso ↔ Disciplina</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Curso</Label>
                <Select value={assocCurso} onValueChange={setAssocCurso}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Selecionar curso" /></SelectTrigger>
                  <SelectContent>{cursos.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Disciplina</Label>
                <Select value={assocDisciplina} onValueChange={setAssocDisciplina}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Selecionar disciplina" /></SelectTrigger>
                  <SelectContent>{disciplinas.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano</Label>
                <Select value={assocAno} onValueChange={setAssocAno}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}º</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Semestre</Label>
                <Select value={assocSemNoAno} onValueChange={setAssocSemNoAno}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1º</SelectItem>
                    <SelectItem value="2">2º</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAssociate}><Plus className="mr-2 h-4 w-4" /> Associar</Button>
            </div>

            {cursoDisciplinas.length > 0 && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Disciplina</TableHead>
                      <TableHead>Ano · Sem</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cursoDisciplinas.map((cd) => (
                      <TableRow key={cd.id}>
                        <TableCell>{cd.curso_nome}</TableCell>
                        <TableCell>{cd.disciplina_nome}</TableCell>
                        <TableCell>{semestreToAno(cd.semestre)}º Ano · {semestreNoAno(cd.semestre)}º Sem</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => { cursosService.removeCursoDisciplina(cd.id).then(() => { toast.success('Associação removida'); load(); }); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
