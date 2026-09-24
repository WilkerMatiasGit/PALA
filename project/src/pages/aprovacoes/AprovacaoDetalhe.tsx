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
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { aprovacoesService } from '@/services/aprovacoes.service';
import { actividadesService } from '@/services/actividades.service';
import { agendamentosService } from '@/services/agendamentos.service';
import { utilizadoresService } from '@/services/utilizadores.service';
import { useAuth } from '@/context/AuthContext';
import { formatEstado, formatTipo, formatAgendamentoEstado } from '@/utils/formatEstado';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import type { ActividadeGet, ActividadeMaterialGet, ActividadeTecnicoGet } from '@/types/actividade.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { AprovacaoGet } from '@/types/aprovacao.types';
import type { AprovacaoDecisao, AprovacaoEtapa } from '@/services/enums';
import type { UtilizadorGet } from '@/types/utilizador.types';
import { CheckCircle, XCircle, FileText, Wrench, ChevronRight, Flag, RotateCcw, Layers } from 'lucide-react';

type Dialog =
  | { kind: 'voto'; ag: AgendamentoGet; decisao: 'aprovar' | 'rejeitar' }
  | { kind: 'lote' }
  | { kind: 'concluir' }
  | { kind: 'rejeitar' }
  | null;

export default function AprovacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [actividade, setActividade] = useState<ActividadeGet | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [materiais, setMateriais] = useState<ActividadeMaterialGet[]>([]);
  const [aprovacoes, setAprovacoes] = useState<AprovacaoGet[]>([]);
  const [tecnicosDisponiveis, setTecnicosDisponiveis] = useState<UtilizadorGet[]>([]);
  const [tecnicosAtribuidos, setTecnicosAtribuidos] = useState<ActividadeTecnicoGet[]>([]);
  const [comentario, setComentario] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [assistenteId, setAssistenteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  // Decisão em massa
  const [selected, setSelected] = useState<number[]>([]);
  const [loteDecisao, setLoteDecisao] = useState<AprovacaoDecisao>('aprovado');
  const [loteComentario, setLoteComentario] = useState('');

  const load = () => {
    if (!id) return;
    const aid = Number(id);
    setLoading(true);
    Promise.all([
      actividadesService.get(aid),
      agendamentosService.listByActividade(aid),
      actividadesService.listMateriais(aid),
      aprovacoesService.listByActividade(aid),
      utilizadoresService.listTecnicos(),
      actividadesService.listTecnicos(aid),
    ]).then(([a, ags, mats, aps, tecns, attrib]) => {
      setActividade(a);
      setAgendamentos(ags);
      setMateriais(mats);
      setAprovacoes(aps);
      setTecnicosDisponiveis(tecns);
      setTecnicosAtribuidos(attrib);
      setSelected([]);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !actividade) return <ErrorState onRetry={load} />;

  const isAdmin = user?.tipo === 'admin';
  const isSupervisor = user?.tipo === 'supervisor';

  const etapaAtual: AprovacaoEtapa | null = isSupervisor
    ? 'supervisor'
    : isAdmin
      ? (actividade.estado === 'revisado_dlab' ? 'supervisor' : 'dlab')
      : user?.tipo === 'coordenador_dlab'
        ? 'dlab'
        : null;

  const estaEmRevisao =
    (actividade.estado === 'pendente' && etapaAtual === 'dlab') ||
    (actividade.estado === 'revisado_dlab' && etapaAtual === 'supervisor');

  const agVotaveis = agendamentos.filter((g) =>
    etapaAtual === 'supervisor'
      ? g.estado === 'aprovado_dlab' || g.estado === 'pendente'
      : g.estado === 'nao_revisto'
  );

  const decisaoIds = new Set<number>(
    aprovacoes
      .filter((a) => a.etapa === etapaAtual && a.agendamento_id != null)
      .map((a) => a.agendamento_id as number)
  );

  const mostraDeixarPendente = estaEmRevisao && etapaAtual === 'dlab';

  const validadorAtribuido = tecnicosAtribuidos.some((t) => t.papel === 'validador');
  const mostraTecnico = etapaAtual === 'supervisor';
  const est = formatEstado(actividade.estado);
  const tipo = formatTipo(actividade.tipo);

  const todosRejeitados = agendamentos.length > 0 && agendamentos.every((g) => g.estado === 'rejeitado');

  const podeReverter = (g: AgendamentoGet) => {
    if (!estaEmRevisao) return false;
    if (etapaAtual === 'dlab') return g.estado !== 'nao_revisto';
    return decisaoIds.has(g.id);
  };

  const toggleSelected = (agendaId: number) => {
    setSelected((s) => (s.includes(agendaId) ? s.filter((x) => x !== agendaId) : [...s, agendaId]));
  };

  const todosSelecionados = agVotaveis.length > 0 && agVotaveis.every((g) => selected.includes(g.id));

  const atribuirTecnicos = async (actividadeId: number) => {
    if (!validadorAtribuido && tecnicoId) {
      await actividadesService.addTecnico({ actividade_id: actividadeId, utilizador_id: Number(tecnicoId), papel: 'validador' });
    }
    if (actividade.precisa_assistente && assistenteId) {
      await actividadesService.addTecnico({ actividade_id: actividadeId, utilizador_id: Number(assistenteId), papel: 'assistente' });
    }
  };

  const handleVoto = async (ag: AgendamentoGet, decisao: 'aprovar' | 'rejeitar') => {
    if (!user) return;
    setSubmitting(true);
    try {
      await aprovacoesService.create({
        agendamento_id: ag.id,
        etapa: etapaAtual!,
        decisao: decisao === 'aprovar' ? 'aprovado' : 'rejeitado',
      });
      toast.success(`Agendamento ${decisao === 'aprovar' ? 'aprovado' : 'rejeitado'}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar decisão');
    } finally {
      setSubmitting(false);
      setDialog(null);
    }
  };

  const handleLote = async () => {
    if (!etapaAtual) return;
    const alvos = agVotaveis.filter((g) => selected.includes(g.id));
    if (alvos.length === 0) return;
    setSubmitting(true);
    try {
      await aprovacoesService.createLote({
        etapa: etapaAtual,
        itens: alvos.map((g) => ({ agendamento_id: g.id, decisao: loteDecisao })),
        comentario: loteComentario.trim() || undefined,
      });
      toast.success(`${alvos.length} agendamento(s) ${loteDecisao === 'aprovado' ? 'aprovado(s)' : 'rejeitado(s)'} em massa`);
      setLoteComentario('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aplicar decisão em massa');
    } finally {
      setSubmitting(false);
      setDialog(null);
    }
  };

  const handleDeixarPendente = async (ag: AgendamentoGet) => {
    setSubmitting(true);
    try {
      await aprovacoesService.deixarPendente(ag.id);
      toast.success('Agendamento deixado pendente');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deixar pendente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRollback = async (ag: AgendamentoGet) => {
    if (!etapaAtual) return;
    setSubmitting(true);
    try {
      await aprovacoesService.rollback(ag.id, etapaAtual);
      toast.success('Decisão revertida');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reverter decisão');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConcluir = async () => {
    if (!comentario.trim()) {
      toast.error('O comentário é obrigatório ao concluir esta etapa');
      setDialog(null);
      return;
    }
    if (etapaAtual === 'supervisor') {
      if (!validadorAtribuido && !tecnicoId) {
        toast.error('Atribua um Técnico (Validador) antes de concluir');
        setDialog(null);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (etapaAtual === 'supervisor' && !validadorAtribuido) {
        await atribuirTecnicos(actividade.id);
      }
      await aprovacoesService.finalizar(actividade.id, comentario.trim());
      toast.success(etapaAtual === 'supervisor' ? 'Aprovação final concluída' : 'Revisão do DLab concluída');
      navigate('/aprovacoes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao concluir revisão');
    } finally {
      setSubmitting(false);
      setDialog(null);
    }
  };

  const handleRejeitar = async () => {
    if (!comentario.trim()) {
      toast.error('A justificação é obrigatória ao rejeitar a atividade');
      setDialog(null);
      return;
    }
    setSubmitting(true);
    try {
      await aprovacoesService.rejeitarActividade(actividade.id, comentario.trim());
      toast.success('Actividade rejeitada');
      navigate('/aprovacoes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao rejeitar atividade');
    } finally {
      setSubmitting(false);
      setDialog(null);
    }
  };

  const confirmarDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'voto') handleVoto(dialog.ag, dialog.decisao);
    else if (dialog.kind === 'lote') handleLote();
    else if (dialog.kind === 'concluir') handleConcluir();
    else handleRejeitar();
  };

  return (
    <div>
      <PageHeader
        title={`Aprovação: ${actividade.nome}`}
        breadcrumbs={[{ label: 'Aprovações', href: '/aprovacoes' }, { label: actividade.nome }]}
        action={
          <div className="flex gap-2">
            <Badge variant="outline" className={tipo.className}>{tipo.label}</Badge>
            <Badge variant="outline" className={est.className}>{est.label}</Badge>
          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-5">
            <div><p className="text-xs text-muted-foreground">Laboratório</p><p className="font-medium">{actividade.laboratorio_nome}</p></div>
            <div><p className="text-xs text-muted-foreground">Criado por</p><p className="font-medium">{actividade.criado_por_nome}</p></div>
            <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{actividade.responsavel_nome}</p></div>
            <div><p className="text-xs text-muted-foreground">Participantes</p><p className="font-medium">{actividade.num_participantes}</p></div>
            <div><p className="text-xs text-muted-foreground">Assistente</p><p className="font-medium">{actividade.precisa_assistente ? 'Sim' : 'Não'}</p></div>
          </div>
          {actividade.observacoes && <p className="pt-3 text-sm text-muted-foreground">{actividade.observacoes}</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="agendamentos">
        <TabsList>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          {mostraTecnico && <TabsTrigger value="tecnico">Técnico & Assistente</TabsTrigger>}
          <TabsTrigger value="decisao">Decisão</TabsTrigger>
        </TabsList>

        <TabsContent value="agendamentos">
          {estaEmRevisao && agVotaveis.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" /> Decisão em massa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Decisão</Label>
                    <Select value={loteDecisao} onValueChange={(v) => setLoteDecisao(v as AprovacaoDecisao)}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aprovado">Aprovar</SelectItem>
                        <SelectItem value="rejeitado">Rejeitar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comentário (único)</Label>
                    <Textarea value={loteComentario} onChange={(e) => setLoteComentario(e.target.value)} rows={1} placeholder="Comentário comum ao lote (opcional)" className="min-w-[280px]" />
                  </div>
                  <Button
                    disabled={submitting || selected.length === 0}
                    onClick={() => setDialog({ kind: 'lote' })}
                  >
                    Aplicar a {selected.length} selecionado(s)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={agVotaveis.length === 0}
                    onClick={() =>
                      setSelected(todosSelecionados ? [] : agVotaveis.map((g) => g.id))
                    }
                  >
                    {todosSelecionados ? 'Limpar seleção' : 'Marcar todos'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Marque os agendamentos e aplique a mesma decisão a todos de uma vez.</p>
              </CardContent>
            </Card>
          )}

          <Card className="p-0">
            {agendamentos.length === 0 ? (
              <div className="p-4"><EmptyState icon={FileText} title="Sem agendamentos" /></div>
            ) : (
              <div className="divide-y">
                {agendamentos.map((ag) => {
                  const agEst = formatAgendamentoEstado(ag.estado);
                  const votavel = estaEmRevisao && agVotaveis.some((g) => g.id === ag.id);
                  const revertivel = podeReverter(ag);
                  const marcado = selected.includes(ag.id);
                  return (
                    <div key={ag.id} className="flex items-start gap-3 p-4">
                      {estaEmRevisao && agVotaveis.length > 0 && (
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => toggleSelected(ag.id)}
                          className="mt-1"
                          disabled={!votavel}
                        />
                      )}
                      <div className="flex-1 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{formatDate(ag.hora_inicio)}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(ag.hora_inicio)} - {formatDateTime(ag.hora_fim)}</p>
                          </div>
                          <Badge variant="outline" className={agEst.className}>{agEst.label}</Badge>
                        </div>
                        {votavel && (
                          <div className="mt-2 flex justify-end gap-2">
                            {mostraDeixarPendente && (
                              <Button size="sm" variant="outline" onClick={() => handleDeixarPendente(ag)} disabled={submitting}>
                                Deixar pendente
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => setDialog({ kind: 'voto', ag, decisao: 'rejeitar' })} disabled={submitting}>
                              <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                            </Button>
                            <Button size="sm" onClick={() => setDialog({ kind: 'voto', ag, decisao: 'aprovar' })} disabled={submitting}>
                              <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                            </Button>
                          </div>
                        )}
                        {revertivel && (
                          <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="ghost" onClick={() => handleRollback(ag)} disabled={submitting}>
                              <RotateCcw className="mr-1 h-3 w-3" /> Rever decisão
                            </Button>
                          </div>
                        )}
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
              <div className="p-4"><EmptyState icon={FileText} title="Sem materiais solicitados" /></div>
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

        {mostraTecnico && (
          <TabsContent value="tecnico">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="h-4 w-4" /> Técnico & Assistente</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tecnicosAtribuidos.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {tecnicosAtribuidos.map((t) => (
                      <div key={t.id} className="flex justify-between">
                        <span className="text-muted-foreground">{t.papel === 'validador' ? 'Validador' : 'Assistente'}</span>
                        <Badge variant="outline">{t.utilizador_nome}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Atribuir Técnico (Validador) *</Label>
                      <Select value={tecnicoId} onValueChange={setTecnicoId}>
                        <SelectTrigger><SelectValue placeholder="Selecionar técnico..." /></SelectTrigger>
                        <SelectContent>{tecnicosDisponiveis.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {actividade.precisa_assistente && (
                      <div className="space-y-2">
                        <Label>Atribuir Assistente</Label>
                        <Select value={assistenteId} onValueChange={setAssistenteId}>
                          <SelectTrigger><SelectValue placeholder="Selecionar assistente..." /></SelectTrigger>
                          <SelectContent>{tecnicosDisponiveis.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">O técnico será atribuído ao concluir a aprovação final.</p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="decisao">
          <Card>
            <CardHeader><CardTitle className="text-base">Concluir / Rejeitar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="comentario">Comentário / Parecer</Label>
                <Textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Escreva o seu parecer técnico..." />
                {estaEmRevisao && (
                  <p className="text-xs text-muted-foreground">
                    O comentário é obrigatório ao concluir a etapa e ao rejeitar a atividade. As decisões individuais não precisam de comentário.
                  </p>
                )}
              </div>

              {estaEmRevisao ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="destructive" onClick={() => setDialog({ kind: 'rejeitar' })} disabled={submitting}>
                    <Flag className="mr-2 h-4 w-4" /> Rejeitar Atividade
                  </Button>
                  <Button onClick={() => setDialog({ kind: 'concluir' })} disabled={submitting}>
                    <ChevronRight className="mr-2 h-4 w-4" />
                    {etapaAtual === 'supervisor' ? 'Concluir Aprovação Final' : 'Concluir Revisão DLab'}
                  </Button>
                  <p className="w-full text-xs text-muted-foreground">
                    {etapaAtual === 'dlab'
                      ? `${agendamentos.filter((g) => g.estado === 'nao_revisto').length} agendamento(s) por rever nesta etapa.`
                      : `${agendamentos.filter((g) => g.estado !== 'aprovado_supervisor' && g.estado !== 'rejeitado').length} agendamento(s) por decidir nesta etapa.`}
                  </p>
                </div>
              ) : (
                <p className="pt-2 text-sm text-muted-foreground">
                  {actividade.estado === 'revisado_supervisor'
                    ? 'A aprovação final já foi concluída. Esta atividade está disponível no calendário.'
                    : 'Esta atividade foi rejeitada e o fluxo foi interrompido.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog(null)}
        title={
          dialog?.kind === 'voto'
            ? (dialog.decisao === 'aprovar' ? 'Confirmar aprovação do agendamento' : 'Confirmar rejeição do agendamento')
            : dialog?.kind === 'lote'
              ? 'Confirmar decisão em massa'
              : dialog?.kind === 'concluir'
                ? (etapaAtual === 'supervisor' ? 'Confirmar aprovação final' : 'Confirmar conclusão da revisão DLab')
                : 'Confirmar rejeição da atividade'
        }
        description={
          dialog?.kind === 'voto'
            ? 'Pretende registar esta decisão para o agendamento selecionado? A decisão pode ser revertida com o botão "Rever decisão".'
            : dialog?.kind === 'lote'
              ? `Pretende ${loteDecisao === 'aprovado' ? 'aprovar' : 'rejeitar'} ${selected.length} agendamento(s) com uma única aprovação em massa?`
              : dialog?.kind === 'concluir'
                ? todosRejeitados
                  ? 'Todos os agendamentos estão rejeitados — concluir irá rejeitar a atividade inteira (mesmo resultado do "Rejeitar atividade"). O comentário é obrigatório e a conclusão não pode ser desfeita.'
                  : 'Pretende concluir esta etapa do fluxo de aprovação? O comentário/parecer é obrigatório e a conclusão não pode ser desfeita.'
                : 'Pretende rejeitar toda a atividade? O fluxo será interrompido imediatamente, todos os agendamentos marcados como rejeitados e a justificação é obrigatória.'
        }
        confirmLabel={
          dialog?.kind === 'voto'
            ? (dialog.decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar')
            : dialog?.kind === 'lote'
              ? 'Aplicar em massa'
              : dialog?.kind === 'concluir'
                ? 'Concluir'
                : 'Rejeitar Atividade'
        }
        variant={dialog?.kind === 'rejeitar' || (dialog?.kind === 'voto' && dialog.decisao === 'rejeitar') || (dialog?.kind === 'concluir' && todosRejeitados) ? 'destructive' : 'default'}
        onConfirm={confirmarDialog}
      />
    </div>
  );
}