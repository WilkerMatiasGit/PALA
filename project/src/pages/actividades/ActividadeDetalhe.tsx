import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { actividadesService } from '@/services/actividades.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { aprovacoesService } from '@/services/aprovacoes.service';
import { formatEstado, formatTipo, formatDecisao, formatPapel, formatAgendamentoEstado } from '@/utils/formatEstado';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import { useAuth } from '@/context/AuthContext';
import type { ActividadeGet, AulaGet, VisitaGet, ProjectoGet, EstagioGet, ActividadeTecnicoGet, ActividadeMaterialGet } from '@/types/actividade.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { AprovacaoGet, AprovacaoAgendamentoItem } from '@/types/aprovacao.types';
import type { AprovacaoDecisao, AprovacaoEtapa } from '@/services/enums';
import { CheckCircle2, Circle, FileText, Upload, User, Wrench, Package, Clock } from 'lucide-react';

interface GrupoHistorico {
  key: string;
  aprovador_nome: string;
  etapa: AprovacaoEtapa;
  decisao: AprovacaoDecisao;
  comentario: string;
  decidido_em: string;
  itens: AprovacaoAgendamentoItem[];
}

export default function ActividadeDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [actividade, setActividade] = useState<ActividadeGet | null>(null);
  const [aula, setAula] = useState<AulaGet | null>(null);
  const [visita, setVisita] = useState<VisitaGet | null>(null);
  const [projecto, setProjecto] = useState<ProjectoGet | null>(null);
  const [estagio, setEstagio] = useState<EstagioGet | null>(null);
  const [tecnicos, setTecnicos] = useState<ActividadeTecnicoGet[]>([]);
  const [materiais, setMateriais] = useState<ActividadeMaterialGet[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [aprovacoes, setAprovacoes] = useState<AprovacaoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleOpenDocumento = (path?: string) => {
    if (!path) return;
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener');
    } else {
      navigator.clipboard?.writeText(path).then(() => toast.success('Caminho do documento copiado')).catch(() => toast.info(path));
    }
  };

  const load = () => {
    if (!id) return;
    const aid = Number(id);
    setLoading(true);
    Promise.all([
      actividadesService.get(aid),
      actividadesService.getAula(aid),
      actividadesService.getVisita(aid),
      actividadesService.getProjecto(aid),
      actividadesService.getEstagio(aid),
      actividadesService.listTecnicos(aid),
      actividadesService.listMateriais(aid),
      agendamentosService.listByActividade(aid),
      aprovacoesService.listByActividade(aid),
    ]).then(([a, au, v, p, e, t, m, ag, ap]) => {
      setActividade(a); setAula(au); setVisita(v); setProjecto(p); setEstagio(e);
      setTecnicos(t); setMateriais(m); setAgendamentos(ag); setAprovacoes(ap);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const grupos = useMemo<GrupoHistorico[]>(() => {
    const map = new Map<string, GrupoHistorico>();
    for (const ap of aprovacoes) {
      const itensLote = ap.agendamentos && ap.agendamentos.length > 0;
      const chave = itensLote
        ? `lote-${ap.id}`
        : `${ap.etapa}|${ap.decisao}|${ap.comentario}|${ap.aprovador_nome}|${ap.decidido_em}`;
      const base = {
        aprovador_nome: ap.aprovador_nome,
        etapa: ap.etapa,
        decisao: ap.decisao,
        comentario: ap.comentario ?? '',
        decidido_em: ap.decidido_em,
      };
      const alvo = map.get(chave);
      if (alvo) {
        alvo.itens.push({ agendamento_id: ap.agendamento_id, decisao: ap.decisao });
      } else {
        map.set(chave, {
          ...base,
          key: chave,
          itens: ap.agendamentos && ap.agendamentos.length > 0
            ? [...ap.agendamentos]
            : [{ agendamento_id: ap.agendamento_id, decisao: ap.decisao }],
        });
      }
    }
    return [...map.values()];
  }, [aprovacoes]);

  if (loading) return <FullPageSpinner />;
  if (error || !actividade) return <ErrorState onRetry={load} />;

  const est = formatEstado(actividade.estado);
  const tipo = formatTipo(actividade.tipo);

  const ehResponsavel = user?.tipo === 'professor' && user.id === actividade.responsavel_id;
  const ehValidador = user?.tipo === 'tecnico' && tecnicos.some((t) => t.utilizador_id === user?.id && t.papel === 'validador');
  const canConfirm = user?.tipo === 'admin' || ehResponsavel;
  const canConfirmTec = user?.tipo === 'admin' || ehValidador;

  const handleConfirmProf = (agId: number) => {
    agendamentosService.confirmarProfessor(agId).then(() => { toast.success('Presença confirmada pelo professor'); load(); });
  };
  const handleConfirmTec = (agId: number) => {
    agendamentosService.confirmarTecnico(agId).then(() => { toast.success('Presença confirmada pelo técnico'); load(); });
  };

  return (
    <div>
      <PageHeader
        title={actividade.nome}
        description={actividade.laboratorio_nome}
        breadcrumbs={[{ label: 'Actividades', href: '/actividades' }, { label: actividade.nome }]}
        action={
          <div className="flex gap-2">
            <Badge variant="outline" className={tipo.className}>{tipo.label}</Badge>
            <Badge variant="outline" className={est.className}>{est.label}</Badge>
          </div>
        }
      />

      <Tabs defaultValue="geral">
        <TabsList className="mb-4">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          {(actividade.tipo === 'projecto' || actividade.tipo === 'estagio') && (
            <TabsTrigger value="documento">Documento</TabsTrigger>
          )}
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Informação geral */}
          <Card>
            <CardHeader><CardTitle className="text-base">Informação Geral</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Laboratório</span><span className="font-medium">{actividade.laboratorio_nome}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Criado por</span><span className="font-medium">{actividade.criado_por_nome}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span className="font-medium">{actividade.responsavel_nome}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Participantes</span><span className="font-medium">{actividade.num_participantes}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Precisa assistente</span><span className="font-medium">{actividade.precisa_assistente ? 'Sim' : 'Não'}</span></div>
              {actividade.observacoes && <Separator />}
              {actividade.observacoes && <div><span className="text-muted-foreground">Observações: </span>{actividade.observacoes}</div>}
            </CardContent>
          </Card>

          {/* Detalhes do tipo */}
          <Card>
            <CardHeader><CardTitle className="text-base">Detalhes ({tipo.label})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {actividade.tipo === 'aula' && aula && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Disciplina</span><span className="font-medium">{aula.curso_disciplina_nome}</span></div>
                  {aula.turma && <div className="flex justify-between"><span className="text-muted-foreground">Turma</span><span className="font-medium font-mono">{aula.turma}</span></div>}
                  {aula.turno && <div className="flex justify-between"><span className="text-muted-foreground">Turno</span><span className="font-medium">{aula.turno === 'manha' ? 'Manhã' : 'Tarde'}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Tema</span><span className="font-medium">{aula.tema || '—'}</span></div>
                </>
              )}
              {actividade.tipo === 'visita' && visita && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Visitante</span><span className="font-medium">{visita.nome_visitante}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Instituição</span><span className="font-medium">{visita.instituicao || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><span className="font-medium">{visita.telefone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{visita.email}</span></div>
                </>
              )}
              {actividade.tipo === 'projecto' && projecto && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Título</span><span className="font-medium">{projecto.titulo}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Início</span><span className="font-medium">{formatDate(projecto.data_inicio)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fim</span><span className="font-medium">{formatDate(projecto.data_fim)}</span></div>
                  {projecto.descricao && <div><span className="text-muted-foreground">Descrição: </span>{projecto.descricao}</div>}
                </>
              )}
              {actividade.tipo === 'estagio' && estagio && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Estudante</span><span className="font-medium">{estagio.estudante_nome}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Início</span><span className="font-medium">{formatDate(estagio.data_inicio)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fim</span><span className="font-medium">{formatDate(estagio.data_fim)}</span></div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Técnico & Assistente */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" /> Técnico & Assistente</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {tecnicos.length === 0 ? (
                <EmptyState icon={User} title="Sem técnicos atribuídos" description="A atribuição ocorre na aprovação do Supervisor." />
              ) : (
                tecnicos.map((t) => {
                  const p = formatPapel(t.papel);
                  return (
                    <div key={t.id} className="flex justify-between">
                      <span className="text-muted-foreground">{p.label}</span>
                      <Badge variant="outline" className={p.className}>{t.utilizador_nome}</Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendamentos">
          <Card>
            <CardHeader><CardTitle className="text-base">Agendamentos</CardTitle></CardHeader>
            <CardContent>
              {agendamentos.length === 0 ? (
                <EmptyState icon={Circle} title="Sem agendamentos" />
              ) : (
                <div className="space-y-2">
                  {agendamentos.map((ag) => {
                    const agEst = formatAgendamentoEstado(ag.estado);
                    const aprovado = ag.estado === 'aprovado_supervisor';
                    return (
                      <div key={ag.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{formatDate(ag.hora_inicio)}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(ag.hora_inicio).split(' às ')[1]} - {formatDateTime(ag.hora_fim).split(' às ')[1]}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ag.realizado ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Realizado</Badge>
                          ) : aprovado ? (
                            <>
                              {ag.confirmado_professor_em ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Prof ✓</Badge>
                              ) : canConfirm ? (
                                <Button size="sm" variant="outline" onClick={() => handleConfirmProf(ag.id)}>Prof. confirmar</Button>
                              ) : (
                                <Badge variant="outline"><Circle className="mr-1 h-3 w-3" /> Prof ☐</Badge>
                              )}
                              {ag.confirmado_tecnico_em ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Técn ✓</Badge>
                              ) : canConfirmTec ? (
                                <Button size="sm" variant="outline" onClick={() => handleConfirmTec(ag.id)}>Téc. confirmar</Button>
                              ) : (
                                <Badge variant="outline"><Circle className="mr-1 h-3 w-3" /> Técn ☐</Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className={agEst.className}>{agEst.label}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materiais">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Materiais Solicitados</CardTitle></CardHeader>
            <CardContent>
              {materiais.length === 0 ? (
                <EmptyState icon={Package} title="Sem materiais solicitados" />
              ) : (
                <div className="space-y-2">
                  {materiais.map((m) => (
                    <div key={m.id} className="flex justify-between rounded-lg border p-3 text-sm">
                      <span className="font-medium">{m.material_nome}</span>
                      <Badge variant="secondary">{m.quantidade_estimada}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(actividade.tipo === 'projecto' || actividade.tipo === 'estagio') && (
          <TabsContent value="documento">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Documento</CardTitle></CardHeader>
              <CardContent>
                {(actividade.tipo === 'projecto' ? projecto?.anexo_path : estagio?.anexo_path) ? (
                  <Button variant="outline" size="sm" onClick={() => handleOpenDocumento(actividade.tipo === 'projecto' ? projecto?.anexo_path : estagio?.anexo_path)}><FileText className="mr-2 h-4 w-4" /> Ver documento</Button>
                ) : (
                  <EmptyState icon={Upload} title="Documento ainda não submetido" description="O anexo pode ser submetido após a conclusão da actividade." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="historico">
          <Card className="p-0">
            {grupos.length === 0 ? (
              <div className="p-4"><EmptyState icon={Circle} title="Sem aprovações registadas" /></div>
            ) : (
              <div className="divide-y">
                {grupos.map((g) => {
                  const d = formatDecisao(g.decisao);
                  return (
                    <div key={g.key} className="p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{g.etapa === 'dlab' ? 'Coordenador DLab' : 'Supervisor'}</span>
                        <Badge variant="outline" className={d.className}>{d.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{g.aprovador_nome} · {formatDate(g.decidido_em)}</p>
                      {g.comentario && <p className="mt-1 text-xs">{g.comentario}</p>}
                      <div className="mt-2 space-y-1">
                        {g.itens.map((item, i) => {
                          const id = item.agendamento_id;
                          const dec = formatDecisao(item.decisao);
                          const horario = item.h_inicio
                            ? `${formatDateTime(item.h_inicio).split(' às ')[1]} - ${formatDateTime(item.h_fim).split(' às ')[1]}`
                            : (id != null ? `Agendamento #${id}` : '—');
                          return (
                            <div key={id ?? i} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {horario}
                              </span>
                              <Badge variant="outline" className={dec.className}>{dec.label}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}