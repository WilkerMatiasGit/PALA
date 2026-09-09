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
import { formatEstado, formatTipo } from '@/utils/formatEstado';
import { formatDate, formatDateTime } from '@/utils/formatDate';
import type { ActividadeGet, ActividadeMaterialGet } from '@/types/actividade.types';
import type { AgendamentoGet } from '@/types/agendamento.types';
import type { UtilizadorGet } from '@/types/utilizador.types';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

export default function AprovacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.tipo === 'admin';
  const isSupervisor = user?.tipo === 'supervisor';

  const [actividade, setActividade] = useState<ActividadeGet | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoGet[]>([]);
  const [materiais, setMateriais] = useState<ActividadeMaterialGet[]>([]);
  const [tecnicos, setTecnicos] = useState<UtilizadorGet[]>([]);
  const [comentario, setComentario] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [assistenteId, setAssistenteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'aprovar' | 'rejeitar' | null>(null);

  const load = () => {
    if (!id) return;
    const aid = Number(id);
    setLoading(true);
    aprovacoesService.get(aid).then(async (aprov) => {
      const act = await actividadesService.get(aprov.actividade_id);
      setActividade(act);
      const [ags, mats, tecnicos] = await Promise.all([
        agendamentosService.listByActividade(act.id),
        actividadesService.listMateriais(act.id),
        utilizadoresService.listTecnicos(),
      ]);
      setAgendamentos(ags);
      setMateriais(mats);
      setTecnicos(tecnicos);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !actividade) return <ErrorState onRetry={load} />;

  const est = formatEstado(actividade.estado);
  const tipo = formatTipo(actividade.tipo);

  // Etapa determinada pelo estado atual da atividade (não pelo role do utilizador)
  const etapaAtual = actividade.estado === 'aprovado_dlab' ? 'supervisor' : 'dlab';
  // A etapa do Supervisor é decidida pelo Admin ou pelo Supervisor
  const podeDecidirSupervisor = isAdmin || isSupervisor;
  const podeDecidir = etapaAtual === 'supervisor' ? podeDecidirSupervisor : true;
  const mostraTecnico = etapaAtual === 'supervisor' && podeDecidirSupervisor;

  const handleDecision = async () => {
    if (!user) return;

    // Validação frontend: parecer técnico é sempre obrigatório
    if (!comentario.trim()) {
      toast.error('O comentário/parecer é obrigatório');
      setConfirmAction(null);
      return;
    }
    // Etapa Supervisor: técnico validador é obrigatório na aprovação
    if (confirmAction === 'aprovar' && mostraTecnico && !tecnicoId) {
      toast.error('Atribua um Técnico (Validador) antes de aprovar');
      setConfirmAction(null);
      return;
    }

    setSubmitting(true);
    try {
      const etapa = etapaAtual;
      await aprovacoesService.create({
        actividade_id: actividade.id,
        etapa,
        decisao: confirmAction === 'aprovar' ? 'aprovado' : 'rejeitado',
        comentario: comentario.trim(),
      }, user.id);

      if (confirmAction === 'aprovar' && mostraTecnico && tecnicoId) {
        await actividadesService.addTecnico({ actividade_id: actividade.id, utilizador_id: Number(tecnicoId), papel: 'validador' });
        if (assistenteId) {
          await actividadesService.addTecnico({ actividade_id: actividade.id, utilizador_id: Number(assistenteId), papel: 'assistente' });
        }
      }

      toast.success(confirmAction === 'aprovar' ? 'Actividade aprovada' : 'Actividade rejeitada');
      navigate('/aprovacoes');
    } catch {
      toast.error('Erro ao processar decisão');
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
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
            <div className="flex justify-between"><span className="text-muted-foreground">Submetido por</span><span className="font-medium">{actividade.utilizador_nome}</span></div>
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
                {agendamentos.map((ag) => (
                  <div key={ag.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{formatDate(ag.hora_inicio)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ag.hora_inicio)} - {formatDateTime(ag.hora_fim)}</p>
                  </div>
                ))}
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

        {/* Decision panel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Decisão</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comentario">Comentário / Parecer</Label>
              <Textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Escreva o seu parecer técnico..." />
            </div>

            {mostraTecnico && (
              <div className="space-y-3 border-t pt-4">
                <div className="space-y-2">
                  <Label>Atribuir Técnico (Validador) *</Label>
                  <Select value={tecnicoId} onValueChange={setTecnicoId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar técnico..." /></SelectTrigger>
                    <SelectContent>{tecnicos.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {actividade.precisa_assistente && (
                  <div className="space-y-2">
                    <Label>Atribuir Assistente</Label>
                    <Select value={assistenteId} onValueChange={setAssistenteId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar assistente..." /></SelectTrigger>
                      <SelectContent>{tecnicos.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {podeDecidir ? (
              <div className="flex gap-2 pt-2">
                <Button variant="destructive" onClick={() => setConfirmAction('rejeitar')} disabled={submitting}>
                  <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                </Button>
                <Button onClick={() => setConfirmAction('aprovar')} disabled={submitting}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Aprovar
                </Button>
              </div>
            ) : (
              <p className="pt-2 text-sm text-muted-foreground">
                {etapaAtual === 'supervisor'
                  ? 'Esta etapa é decidida pelo Supervisor ou pelo Admin.'
                  : 'A decisão desta etapa está reservada ao Coordenador DLab e ao Admin.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmAction} onOpenChange={(v) => !v && setConfirmAction(null)}
        title={confirmAction === 'aprovar' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
        description={confirmAction === 'aprovar'
          ? 'Pretende aprovar esta actividade? Esta ação não pode ser desfeita.'
          : 'Pretende rejeitar esta actividade? O fluxo será interrompido.'}
        confirmLabel={confirmAction === 'aprovar' ? 'Aprovar' : 'Rejeitar'}
        variant={confirmAction === 'aprovar' ? 'default' : 'destructive'}
        onConfirm={handleDecision}
      />
    </div>
  );
}
