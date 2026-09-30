import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { aprovacoesService } from '@/services/aprovacoes.service';
import { actividadesService } from '@/services/actividades.service';
import { utilizadoresService } from '@/services/utilizadores.service';
import { useAuth } from '@/context/AuthContext';
import { formatEstado, formatTipo, formatAgendamentoEstado, formatDecisao, formatEtapa } from '@/utils/formatEstado';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import type { ActividadeMaterialGet } from '@/types/actividade.types';
import type {
  AprovacaoAgendamentoDetalhe,
  AprovacaoDetalheGet,
  DecisaoGet,
} from '@/types/aprovacao.types';
import type { AprovacaoDecisao } from '@/services/enums';
import type { UtilizadorGet } from '@/types/utilizador.types';
import {
  CheckCircle,
  XCircle,
  FileText,
  Flag,
  Layers,
  History,
  Clock,
  Users,
  UserCheck,
} from 'lucide-react';

/** Aprovação DLab marcada localmente — ainda nada foi gravado até premir "Concluir". */
type Marcacao = { decisao: AprovacaoDecisao | 'pendente'; comentario?: string };

type CommentKind =
  | { kind: 'rejeitar-dlab'; agendamentoId: number }
  | { kind: 'rejeitar-supervisor'; agendamentoId: number }
  | { kind: 'lote-rejeitar' }
  | { kind: 'rejeitar-actividade' }
  | null;

export default function AprovacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [detalhe, setDetalhe] = useState<AprovacaoDetalheGet | null>(null);
  const [materiais, setMateriais] = useState<ActividadeMaterialGet[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoGet[]>([]);
  const [tecnicosDisponiveis, setTecnicosDisponiveis] = useState<UtilizadorGet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selected, setSelected] = useState<number[]>([]);
  const [loteDecisao, setLoteDecisao] = useState<AprovacaoDecisao>('aprovado');
  const [loteComentario, setLoteComentario] = useState('');
  const [justificacao, setJustificacao] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'lote-aprovar' } | null>(null);
  const [comment, setComment] = useState<CommentKind>(null);

  // Fluxo por agendamento (DLab): marcações locais até "Concluir".
  const [marcados, setMarcados] = useState<Record<number, Marcacao>>({});

  // Modal de aprovação do Supervisor: seleção do par de técnicos (validador+assistente).
  const [tecModalId, setTecModalId] = useState<number | null>(null);
  const [tecnicoId, setTecnicoId] = useState('');
  const [assistenteId, setAssistenteId] = useState('');

  const load = () => {
    if (!id) return;
    const aid = Number(id);
    setLoading(true);
    Promise.all([
      aprovacoesService.get(aid),
      actividadesService.listMateriais(aid),
      aprovacoesService.listDecisoes(aid),
      utilizadoresService.listTecnicos(),
    ])
      .then(([d, mats, decs, tecns]) => {
        setDetalhe(d);
        setMateriais(mats);
        setDecisoes(decs);
        setTecnicosDisponiveis(tecns);
        setSelected([]);
        setMarcados({});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !detalhe) return <ErrorState onRetry={load} />;

  const agendamentos = detalhe.agendamentos;
  const votaveis = agendamentos.filter((g) => g.pode_decidir);
  const podeDlab = user?.tipo === 'admin' || user?.tipo === 'coordenador_dlab';
  const podeSup = user?.tipo === 'admin' || user?.tipo === 'supervisor';
  // Rejeição explícita da atividade só quando nenhuma sessão está aprovada/realizada.
  const temIntocaveis = agendamentos.some((g) => g.estado === 'aprovado_supervisor' || g.realizado);
  const algumaEtapaSupervisor = votaveis.some((g) => selected.includes(g.id) && g.etapa_alvo === 'supervisor');
  const loteDecisaoEfectiva: AprovacaoDecisao = algumaEtapaSupervisor ? 'rejeitado' : loteDecisao;

  const toggleSelected = (agendamentoId: number) => {
    setSelected((s) => (s.includes(agendamentoId) ? s.filter((x) => x !== agendamentoId) : [...s, agendamentoId]));
  };

  const todosSelecionados = votaveis.length > 0 && votaveis.every((g) => selected.includes(g.id));

  // ---- Marcações locais (DLab) ----
  const marcarAprovado = (ag: AprovacaoAgendamentoDetalhe) => {
    setMarcados((m) => ({ ...m, [ag.id]: { decisao: 'aprovado' } }));
  };
  const marcarPendente = (ag: AprovacaoAgendamentoDetalhe) => {
    setMarcados((m) => ({ ...m, [ag.id]: { decisao: 'pendente' } }));
  };
  const alterarDecisao = (ag: AprovacaoAgendamentoDetalhe) => {
    setMarcados((m) => {
      const n = { ...m };
      delete n[ag.id];
      return n;
    });
  };

  // "Concluir" — único botão que persiste uma marcação feita no DLab.
  const concluirDlab = async (ag: AprovacaoAgendamentoDetalhe) => {
    const marc = marcados[ag.id];
    if (!marc) return;
    setSubmitting(true);
    try {
      if (marc.decisao === 'pendente') {
        await aprovacoesService.deixarPendente(ag.id);
        toast.success('Agendamento deixado pendente');
      } else {
        await aprovacoesService.create({
          agendamento_id: ag.id,
          etapa: 'dlab',
          decisao: 'aprovado',
        });
        toast.success('Agendamento aprovado (DLab)');
      }
      setMarcados((m) => {
        const n = { ...m };
        delete n[ag.id];
        return n;
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir a decisão');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Modal do Supervisor: aprovar com técnicos ----
  const concluirSupervisorAprovado = async (ag: AprovacaoAgendamentoDetalhe) => {
    if (!tecnicoId || !assistenteId) {
      toast.error('É obrigatório indicar o técnico validador e o técnico assistente');
      return;
    }
    setSubmitting(true);
    try {
      await aprovacoesService.create({
        agendamento_id: ag.id,
        etapa: 'supervisor',
        decisao: 'aprovado',
        tecnicos: { validador_id: Number(tecnicoId), assistente_id: Number(assistenteId) },
      });
      toast.success('Agendamento aprovado e técnicos atribuídos');
      resetTecModal();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar com técnicos');
    } finally {
      setSubmitting(false);
    }
  };

  const resetTecModal = () => {
    setTecModalId(null);
    setTecnicoId('');
    setAssistenteId('');
  };

  // ---- Rejeição do Supervisor e outros diálogos ----
  const abrirRejeicaoSupervisor = (ag: AprovacaoAgendamentoDetalhe) => {
    setJustificacao('');
    setComment({ kind: 'rejeitar-supervisor', agendamentoId: ag.id });
  };

  const handleComComentario = async () => {
    if (!comment) return;
    if (!justificacao.trim()) {
      toast.error('A justificação é obrigatória ao rejeitar');
      return;
    }
    setSubmitting(true);
    try {
      const texto = justificacao.trim();
      if (comment.kind === 'rejeitar-dlab' && comment.agendamentoId != null) {
        await aprovacoesService.create({
          agendamento_id: comment.agendamentoId,
          etapa: 'dlab',
          decisao: 'rejeitado',
          comentario: texto,
        });
        toast.success('Agendamento rejeitado');
      } else if (comment.kind === 'rejeitar-supervisor' && comment.agendamentoId != null) {
        await aprovacoesService.create({
          agendamento_id: comment.agendamentoId,
          etapa: 'supervisor',
          decisao: 'rejeitado',
          comentario: texto,
        });
        toast.success('Agendamento rejeitado');
      } else if (comment.kind === 'lote-rejeitar') {
        const alvos = votaveis.filter((g) => selected.includes(g.id));
        await aprovacoesService.createLote({
          itens: alvos.map((g) => ({ agendamento_id: g.id, decisao: 'rejeitado' as AprovacaoDecisao })),
          comentario: texto,
        });
        toast.success(`${alvos.length} agendamento(s) rejeitado(s)`);
      } else {
        await aprovacoesService.rejeitarActividade(detalhe.id, texto);
        toast.success('Atividade rejeitada');
        navigate('/aprovacoes');
        return;
      }
      setComment(null);
      setJustificacao('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLote = async () => {
    const alvos = votaveis.filter((g) => selected.includes(g.id));
    if (alvos.length === 0) return;
    setSubmitting(true);
    try {
      await aprovacoesService.createLote({
        itens: alvos.map((g) => ({ agendamento_id: g.id, decisao: loteDecisaoEfectiva })),
        comentario: loteComentario.trim() || undefined,
      });
      toast.success(`${alvos.length} agendamento(s) ${loteDecisaoEfectiva === 'aprovado' ? 'aprovado(s)' : 'rejeitado(s)'}`);
      setLoteComentario('');
      setConfirm(null);
      setComment(null);
      setJustificacao('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aplicar decisão em massa');
    } finally {
      setSubmitting(false);
    }
  };

  const est = formatEstado(detalhe.estado);
  const tipo = formatTipo(detalhe.tipo);
  const emEspera = votaveis.length;
  const totalPart = agendamentos.reduce((s, g) => s + (g.num_participantes || 0), 0);

  const descricaoComentario =
    comment?.kind === 'rejeitar-actividade'
      ? 'Todos os agendamentos à espera serão rejeitados. A justificação é obrigatória e a decisão não pode ser desfeita.'
      : 'A justificação é obrigatória ao rejeitar e fica registada no histórico de decisões.';

  return (
    <div>
      <PageHeader
        title={detalhe.nome}
        breadcrumbs={[{ label: 'Aprovações', href: '/aprovacoes' }, { label: detalhe.nome }]}
        action={
          <div className="flex gap-2">
            <Badge variant="outline" className={tipo.className}>
              {tipo.label}
            </Badge>
            <Badge variant="outline" className={est.className}>
              {est.label}
            </Badge>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Laboratório</p>
              <p className="font-medium">{detalhe.laboratorio_nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Criado por</p>
              <p className="font-medium">{detalhe.criado_por_nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="font-medium">{detalhe.responsavel_nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agendamentos</p>
              <p className="font-medium">{agendamentos.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Por decidir</p>
              <p className="font-medium">{emEspera}</p>
            </div>
          </div>
          {detalhe.observacoes && (
            <p className="pt-3 text-sm text-muted-foreground">{detalhe.observacoes}</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="agendamentos">
        <TabsList>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="decisoes">
            <span className="flex items-center gap-1">
              <History className="h-3 w-3" /> Decisões
            </span>
          </TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
        </TabsList>

        <TabsContent value="agendamentos">
          {/* Card Agendamentos primeiro */}
          <Card className="p-0">
            {agendamentos.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={FileText} title="Sem agendamentos" />
              </div>
            ) : (
              <div className="divide-y">
                {agendamentos.map((ag) => {
                  const agEst = formatAgendamentoEstado(ag.estado);
                  const marcado = marcados[ag.id];
                  const selecionavel = ag.pode_decidir && !marcado;
                  const podeDeixarPendente = ag.pode_decidir && ag.etapa_alvo === 'dlab';
                  return (
                    <div key={ag.id} className="flex items-start gap-3 p-4">
                      {votaveis.length > 0 && (
                        <Checkbox
                          checked={selected.includes(ag.id)}
                          onCheckedChange={() => toggleSelected(ag.id)}
                          className="mt-1"
                          disabled={!selecionavel}
                        />
                      )}
                      <div className="flex-1 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{formatDate(ag.hora_inicio)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(ag.hora_inicio)} - {formatDateTime(ag.hora_fim)}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" /> {ag.num_participantes} participante(s)
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className={agEst.className}>
                              {agEst.label}
                            </Badge>
                            {ag.etapa_alvo && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {formatEtapa(ag.etapa_alvo)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {(ag.validador_nome || ag.assistente_nome) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {ag.validador_nome && (
                              <Badge variant="outline" className="gap-1">
                                <UserCheck className="h-3 w-3" /> Validador: {ag.validador_nome}
                              </Badge>
                            )}
                            {ag.assistente_nome && (
                              <Badge variant="outline" className="gap-1">
                                <UserCheck className="h-3 w-3" /> Assistente: {ag.assistente_nome}
                              </Badge>
                            )}
                          </div>
                        )}

                        {ag.decisoes.length > 0 && (
                          <div className="mt-2 space-y-1 border-l-2 pl-3">
                            {ag.decisoes.map((d) => {
                              const dEst = formatDecisao(d.decisao);
                              return (
                                <div key={d.id} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{d.decisor_nome}</span>{' '}
                                  <span>({formatEtapa(d.etapa)})</span>{' '}
                                  <Badge variant="outline" className={dEst.className}>
                                    {dEst.label}
                                  </Badge>{' '}
                                  {d.comentario && <span className="italic">“{d.comentario}”</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {marcado && (
                          <div className="mt-3 rounded-md border border-dashed border-amber-300 bg-amber-50 p-2">
                            <p className="text-xs font-medium text-amber-800">
                              {marcado.decisao === 'aprovado' && 'Aprovado — pronto a concluir'}
                              {marcado.decisao === 'pendente' && 'Deixar pendente — pronto a concluir'}
                            </p>
                            <div className="mt-2 flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => alterarDecisao(ag)}
                                disabled={submitting}
                              >
                                Alterar decisão
                              </Button>
                              <Button size="sm" onClick={() => concluirDlab(ag)} disabled={submitting}>
                                Concluir
                              </Button>
                            </div>
                          </div>
                        )}

                        {!marcado && ag.pode_decidir && (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {podeDeixarPendente && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => marcarPendente(ag)}
                                disabled={submitting}
                              >
                                Deixar pendente
                              </Button>
                            )}
                            {podeSup && ag.etapa_alvo === 'supervisor' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => abrirRejeicaoSupervisor(ag)}
                                  disabled={submitting}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setTecnicoId('');
                                    setAssistenteId('');
                                    setTecModalId(ag.id);
                                  }}
                                  disabled={submitting}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setJustificacao('');
                                    setComment({ kind: 'rejeitar-dlab', agendamentoId: ag.id });
                                  }}
                                  disabled={submitting}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => marcarAprovado(ag)}
                                  disabled={submitting}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Card Decisão em massa segundo */}
          {votaveis.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4" /> Decisão em massa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  {podeDlab && (
                    <div className="space-y-1">
                      <Label className="text-xs">Decisão</Label>
                      <Select value={loteDecisaoEfectiva} onValueChange={(v) => setLoteDecisao(v as AprovacaoDecisao)}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aprovado" disabled={algumaEtapaSupervisor}>Aprovar</SelectItem>
                          <SelectItem value="rejeitado">Rejeitar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!podeDlab && (
                    <div className="space-y-1">
                      <Label className="text-xs">Ação</Label>
                      <p className="text-sm font-medium text-red-600">Rejeitar selecionados</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Comentário (único)</Label>
                    <Textarea
                      value={loteComentario}
                      onChange={(e) => setLoteComentario(e.target.value)}
                      rows={1}
                      placeholder="Comentário comum ao lote (opcional)"
                      className="min-w-[280px]"
                    />
                  </div>
                  <Button
                    disabled={submitting || selected.length === 0}
                    onClick={() =>
                      loteDecisaoEfectiva === 'aprovado' && podeDlab
                        ? setConfirm({ kind: 'lote-aprovar' })
                        : setComment({ kind: 'lote-rejeitar' })
                    }
                  >
                    Aplicar a {selected.length} selecionado(s)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelected(todosSelecionados ? [] : votaveis.map((g) => g.id))}
                  >
                    {todosSelecionados ? 'Limpar seleção' : 'Marcar todos'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {podeDlab
                    ? 'Só estão selecionáveis os agendamentos à espera na sua etapa. A justificação é obrigatória se estiver a rejeitar. «Aprovar» fica indisponível assim que a seleção incluir alguma sessão na etapa do Supervisor (a decisão passa a «Rejeitar» e volta a permitir aprovar quando deixar de haver sessões do Supervisor selecionadas).'
                    : 'No Supervisor, a aprovação é feita por sessão (atribui o técnico validador e o assistente); em massa, só pode rejeitar.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decisoes">
          <Card className="p-0">
            {decisoes.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={History} title="Sem decisões registadas" />
              </div>
            ) : (
              <div className="divide-y">
                {decisoes.map((d) => {
                  const dEst = formatDecisao(d.decisao);
                  return (
                    <div key={d.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                      <div>
                        <p className="font-medium">{d.decisor_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEtapa(d.etapa)} · {formatDateTime(d.criado_em)}
                        </p>
                        {d.comentario && (
                          <p className="mt-1 text-xs italic text-muted-foreground">“{d.comentario}”</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={dEst.className}>
                          {dEst.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Agendamento #{d.agendamento_id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="materiais">
          <Card className="p-0">
            {materiais.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={FileText} title="Sem materiais solicitados" />
              </div>
            ) : (
              <div className="divide-y">
                {materiais.map((m) => (
                  <div key={m.id} className="flex justify-between p-4 text-sm">
                    <span className="font-medium">{m.material_nome}</span>
                    <Badge variant="secondary">{m.quantidade_estimada}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {!temIntocaveis && votaveis.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {emEspera} de {agendamentos.length} agendamento(s) à espera na sua etapa · {totalPart} participantes
            no total
          </p>
          <Button
            variant="destructive"
            onClick={() => setComment({ kind: 'rejeitar-actividade' })}
            disabled={submitting}
          >
            <Flag className="mr-2 h-4 w-4" /> Rejeitar Atividade
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.kind === 'lote-aprovar'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Confirmar decisão em massa"
        description={`Pretende aprovar ${selected.length} agendamento(s)? As decisões ficam registadas no histórico.`}
        confirmLabel="Aplicar em massa"
        onConfirm={handleLote}
      />

      {/* Modal do Supervisor: aprovar exige o par de técnicos */}
      <Dialog
        open={tecModalId != null}
        onOpenChange={(v) => {
          if (!v) resetTecModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar agendamento e atribuir técnicos</DialogTitle>
            <DialogDescription>
              A aprovação do Supervisor grava a decisão e as atribuições de validador e assistente desta sessão
              (podem ser a mesma pessoa). Só é gravado ao premir Concluir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Técnico (Validador) *</Label>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar técnico validador..." />
                </SelectTrigger>
                <SelectContent>
                  {tecnicosDisponiveis.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assistente *</Label>
              <Select value={assistenteId} onValueChange={setAssistenteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar assistente..." />
                </SelectTrigger>
                <SelectContent>
                  {tecnicosDisponiveis.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetTecModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const ag = agendamentos.find((g) => g.id === tecModalId);
                if (ag) concluirSupervisorAprovado(ag);
              }}
              disabled={submitting}
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!comment}
        onOpenChange={(v) => {
          if (!v) {
            setComment(null);
            setJustificacao('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {comment?.kind === 'rejeitar-actividade' ? 'Rejeitar atividade' : 'Justificar rejeição'}
            </DialogTitle>
            <DialogDescription>{descricaoComentario}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justificacao">Justificação *</Label>
            <Textarea
              id="justificacao"
              value={justificacao}
              onChange={(e) => setJustificacao(e.target.value)}
              rows={4}
              placeholder="Explique o motivo da rejeição..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComment(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleComComentario} disabled={submitting}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}