import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { cursosService } from '@/services/cursos.service';
import { formatDate } from '@/utils/formatDate';
import { formatTipo, formatEstado } from '@/utils/formatEstado';
import type { EstudanteGet, EstudanteActividadeGet } from '@/types/estudantes.types';
import { User, GraduationCap, CalendarDays, ChevronRight } from 'lucide-react';

export default function EstudanteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estudante, setEstudante] = useState<EstudanteGet | null>(null);
  const [actividades, setActividades] = useState<EstudanteActividadeGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    if (!id) return;
    const estudanteId = Number(id);
    setLoading(true); setError(false);
    Promise.all([
      cursosService.getEstudante(estudanteId),
      cursosService.listEstudanteActividades(estudanteId),
    ]).then(([e, a]) => {
      setEstudante(e); setActividades(a);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !estudante) return <ErrorState onRetry={load} />;

  return (
    <div>
      <PageHeader
        title={estudante.nome}
        breadcrumbs={[{ label: 'Estudantes', href: '/estudantes' }, { label: estudante.nome }]}
        action={<Badge variant="secondary">{estudante.curso_nome}</Badge>}
      />

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{estudante.nome}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Curso</p>
                    <p className="font-medium">{estudante.curso_nome}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nº Matrícula</p>
                    <p className="font-mono font-medium">{estudante.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="actividades">
          <Card className="p-0">
            {actividades.length === 0 ? (
              <EmptyState icon={GraduationCap} title="Sem actividades" description="Este estudante ainda não está vinculado a nenhuma actividade." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actividade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Laboratório</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actividades.map((a) => {
                    const tipo = a.tipo ? formatTipo(a.tipo) : null;
                    const estado = a.estado ? formatEstado(a.estado) : null;
                    return (
                      <TableRow key={a.estagio_id} className={a.actividade_id ? 'cursor-pointer' : ''} onClick={() => a.actividade_id && navigate(`/actividades/${a.actividade_id}`)}>
                        <TableCell className="font-medium">{a.nome ?? '—'}</TableCell>
                        <TableCell>{tipo ? <Badge variant="secondary" className={tipo.className}>{tipo.label}</Badge> : '—'}</TableCell>
                        <TableCell>{estado ? <Badge variant="secondary" className={estado.className}>{estado.label}</Badge> : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{a.laboratorio_nome ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(a.data_inicio)} → {formatDate(a.data_fim)}</TableCell>
                        <TableCell className="text-right"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}