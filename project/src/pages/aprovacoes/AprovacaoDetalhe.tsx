import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import type { UtilizadorGet } from '@/types/utilizador.types';
import { CheckCircle, XCircle, FileText, Wrench, ChevronRight, Flag, RotateCcw } from 'lucide-react';

type Dialog =
  | { kind: 'voto'; ag: AgendamentoGet; decisao: 'aprovar' | 'rejeitar' }
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
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !actividade) return <ErrorState onRetry={load} />;

  const isAdmin = user?.tipo === 'admin';
  const isSupervisor = user?.tipo === 'supervisor';

  // Etapa atual coerente com o estado da atividade
  const etapaAtual: 'dlab' | 'supervisor' | null = isSupervisor
    ? 'supervisor'
    : isAdmin
      ? (actividade.estado === 'revisado_dlab' ? 'supervisor' : 'dlab')
      : user?.tipo === 'coordenador_dlab'
        ? 'dlab'
        : null;

  const estaEmRevisao =
    (actividade.estado === 'pendente' && etapaAtual === 'dlab') ||
    (actividade.estado === 'revisado_dlab' && etapaAtual === 'supervisor');

  // Agendamentos que aguardam a decisão desta etapa.
  // Etapa 1 (DLab): os ainda não revistos (nao_revisto).
  // Etapa 2 (Supervisor): os aprovados pelo DLab ou deixados pendentes pelo DLab.
  const agVotaveis = agendamentos.filter((g) =>
    etapaAtual === 'supervisor'
      ? g.estado === 'aprovado_dlab' || g.estado === 'pendente'
      : g.estado === 'nao_revisto'
  );

  // Decisões individuais já emitidas nesta etapa (para permitir rollback)
  const decisaoIds = new Set<number>(
    aprovacoes
      .filter((a) => a.etapa === etapaAtual && a.agendamento_id != null)
      .map((a) => a.agendamento_id as number)
  );

  // Bug 1.2: "Deixar pendente" existe apenas na etapa 1 (DLab). Na etapa 2
  // (Supervisor, incluindo admin) não há etapa seguinte para adiar a decisão.
  const mostraDeixarPendente = estaEmRevisao && etapaAtual === 'dlab';

  const validadorAtribuido = tecnicosAtribuidos.some((t) => t.papel === 'validador');
  const mostraTecnico = etapaAtual === 'supervisor';
  const est = formatEstado(actividade.estado);
  const tipo = formatTipo(actividade.tipo);

  // Todos os agendamentos rejeitados → concluir a etapa rejeita a atividade inteira
  const todosRejeitados = agendamentos.length > 0 && agendamentos.every((g) => g.estado === 'rejeitado');

  const podeReverter = (g: AgendamentoGet) => {
    if (!estaEmRevisao) return false;
    if (etapaAtual === 'dlab') return g.estado !== 'nao_revisto';
    // etapa 2: só reverte se houver uma decisão do Supervisor nesta sessão
    return decisaoIds.has(g.id);
  };

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
    // Nenhuma ação individual exige comentário — só os botões de conclusão de etapa.

    setSubmitting(true);
    try {
      await aprovacoesService.create({
        agendamento_id: ag.id,
        etapa: etapaAtual!,
        decisao: decisao === 'aprovar' ? 'aprovado' : 'rejeitado',
        comentario: comentario.trim() || undefined,
      }, user.id);
      toast.success(`Agendamento ${decisao === 'aprovar' ? 'aprovado' : 'rejeitado'}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar decisão');
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
    if (etapaAtual === 'dlab') {
      const porRevistar = agendamentos.filter((g) => g.estado === 'nao_revisto').length;
      if (porRevistar > 0) {
        toast.error(`Ainda existem ${porRevistar} agendamento(s) por rever nesta etapa`);
        setDialog(null);
        return;
      }
    } else if (etapaAtual === 'supervisor') {
      const porFinalizar = agendamentos.filter((g) => g.estado !== 'aprovado_supervisor' && g.estado !== 'rejeitado').length;
      if (porFinalizar > 0) {
        toast.error(`Ainda existem ${porFinalizar} agendamento(s) por decidir na aprovação final`);
        setDialog(null);
        return;
      }
      // Bug 1.4: o técnico validador só é exigido na conclusão, não por cada aprovação
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados da Actividade</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Laboratório</span><span className="font-medium">{actividade.laboratorio_nome}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Criado por</span><span className="font-medium">{actividade.criado_por_nome}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Responsável</span><span className="font-medium">{actividade.responsavel_nome}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Participantes</span><span className="font-medium">{actividade.num_participantes}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Precisa assistente</span><span className="font-medium">{actividade.precisa_assistente ? 'Sim' : 'Não'}</span></div>
            {actividade.observacoes && <p className="pt-2 text-muted-foreground">{actividade.observacoes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Agendamentos Propostos</CardTitle></CardHeader>
          <CardContent>
            {agendamentos.length === 0 ? (
              <EmptyState icon={FileText} title="Sem agendamentos" />
            ) : (
              <div className="space-y-2">
                {agendamentos.map((ag) => {
                  const agEst = formatAgendamentoEstado(ag.estado);
                  const votavel = estaEmRevisao && agVotaveis.some((g) => g.id === ag.id);
                  const revertivel = podeReverter(ag);
                  return (
                    <div key={ag.id} className="rounded-lg border p-3 text-sm">
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Materiais Solicitados</CardTitle></CardHeader>
          <CardContent>
            {materiais.length === 0 ? (
              <EmptyState icon={FileText} title="Sem materiais solicitados" />
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

        {mostraTecnico && (
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
        )}

        {/* Decision panel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Decisão</CardTitle></CardHeader>
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
                    : `${agendamentos.filter((g) => g.estado !== 'aprovado_supervisor' && g.estado !== 'rejeitado').length} agendamento(s) por decidir nesta etapa. Tem de decidir todos antes de concluir.`}
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
      </div>

      <ConfirmDialog
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog(null)}
        title={
          dialog?.kind === 'voto'
            ? (dialog.decisao === 'aprovar' ? 'Confirmar aprovação do agendamento' : 'Confirmar rejeição do agendamento')
            : dialog?.kind === 'concluir'
              ? (etapaAtual === 'supervisor' ? 'Confirmar aprovação final' : 'Confirmar conclusão da revisão DLab')
              : 'Confirmar rejeição da atividade'
        }
        description={
          dialog?.kind === 'voto'
            ? 'Pretende registar esta decisão para o agendamento selecionado? A decisão pode ser revertida com o botão "Rever decisão".'
            : dialog?.kind === 'concluir'
              ? todosRejeitados
                ? 'Todos os agendamentos estão rejeitados — concluir irá rejeitar a atividade inteira (mesmo resultado do "Rejeitar atividade"). O comentário é obrigatório e a conclusão não pode ser desfeita.'
                : 'Pretende concluir esta etapa do fluxo de aprovação? O comentário/parecer é obrigatório e a conclusão não pode ser desfeita.'
              : 'Pretende rejeitar toda a atividade? O fluxo será interrompido imediatamente, todos os agendamentos marcados como rejeitados e a justificação é obrigatória.'
        }
        confirmLabel={
          dialog?.kind === 'voto'
            ? (dialog.decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar')
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