import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FiltersBar, type FilterField } from '@/components/ui/filters-bar';
import { SimplePagination } from '@/components/ui/simple-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { Label } from '@/components/ui/label';
import { cursosService } from '@/services/cursos.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { DEPARTAMENTO_LABELS } from '@/services/enums';
import { PAGE_SIZE, semestreToAno, semestreNoAno, anoSemestreToSemestre } from '@/utils/constants';
import type { CursoGet } from '@/types/curso.types';
import type { DisciplinaGet, CursoDisciplinaGet } from '@/types/disciplina.types';
import { Plus, Trash2, BookOpen } from 'lucide-react';

export default function CursoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = hasRole(user?.tipo, ['admin']);

  const cursoId = Number(id);
  const [curso, setCurso] = useState<CursoGet | null>(null);
  const [disciplinas, setDisciplinas] = useState<DisciplinaGet[]>([]);
  const [cursoDisciplinas, setCursoDisciplinas] = useState<CursoDisciplinaGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const [assocDisciplina, setAssocDisciplina] = useState('');
  const [assocAno, setAssocAno] = useState('1');
  const [assocSemNoAno, setAssocSemNoAno] = useState('1');

  const load = () => {
    setLoading(true); setError(false);
    Promise.all([
      cursosService.getCurso(cursoId),
      cursosService.listDisciplinas(),
      cursosService.listCursoDisciplinas(cursoId),
    ]).then(([c, d, cd]) => {
      setCurso(c); setDisciplinas(d); setCursoDisciplinas(cd);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id && Number.isFinite(cursoId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    let result = [...cursoDisciplinas];
    if (filters.disciplina) result = result.filter((cd) => cd.disciplina_nome.toLowerCase().includes(filters.disciplina.toLowerCase()));
    return result;
  }, [cursoDisciplinas, filters]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterFields: FilterField[] = [
    { key: 'disciplina', label: 'Disciplina', type: 'text', placeholder: 'Pesquisar...' },
  ];

  const disciplinaOptions = disciplinas
    .filter((d) => !cursoDisciplinas.some((cd) => cd.disciplina_id === d.id))
    .map((d) => ({ value: String(d.id), label: d.nome }));

  const handleAssociate = async () => {
    if (!assocDisciplina) { toast.error('Selecione uma disciplina'); return; }
    try {
      await cursosService.createCursoDisciplina({
        curso_id: cursoId,
        disciplina_id: Number(assocDisciplina),
        semestre: anoSemestreToSemestre(Number(assocAno), Number(assocSemNoAno)),
      });
      toast.success('Disciplina associada ao curso');
      setAssocDisciplina(''); setAssocAno('1'); setAssocSemNoAno('1');
      load();
    } catch {
      toast.error('Erro ao associar');
    }
  };

  if (loading) return <FullPageSpinner />;
  if (error || !curso) return <ErrorState onRetry={load} />;

  return (
    <div>
      <PageHeader
        title={curso.nome}
        breadcrumbs={[{ label: 'Cursos', href: '/cursos' }, { label: curso.nome }]}
        action={<Badge variant="secondary">{DEPARTAMENTO_LABELS[curso.departamento]} · {curso.abreviacao}</Badge>}
      />

      {canEdit && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Disciplina</Label>
                <SearchSelect
                  value={assocDisciplina}
                  onValueChange={setAssocDisciplina}
                  options={disciplinaOptions}
                  placeholder="Selecionar disciplina"
                  emptyMessage="Todas as disciplinas já associadas."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ano</Label>
                <Select value={assocAno} onValueChange={setAssocAno}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}º</SelectItem>)}
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
          </CardContent>
        </Card>
      )}

      <FiltersBar fields={filterFields} values={filters} onChange={(k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); }} onReset={() => { setFilters({}); setPage(1); }} />

      <Card className="p-0">
        {pageData.length === 0 ? (
          <EmptyState icon={BookOpen} title="Sem disciplinas associadas" description="Associe disciplinas ao curso no formulário acima." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disciplina</TableHead>
                <TableHead>Ano · Sem</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((cd) => (
                <TableRow key={cd.id}>
                  <TableCell className="font-medium">{cd.disciplina_nome}</TableCell>
                  <TableCell>{semestreToAno(cd.semestre)}º Ano · {semestreNoAno(cd.semestre)}º Sem</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { cursosService.removeCursoDisciplina(cd.id).then(() => { toast.success('Associação removida'); load(); }); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SimplePagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}