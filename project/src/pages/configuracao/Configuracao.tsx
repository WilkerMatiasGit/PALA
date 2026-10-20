import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NumberInput } from '@/components/ui/number-input';
import { Switch } from '@/components/ui/switch';
import { ErrorState } from '@/components/ui/error-state';
import { configuracaoService } from '@/services/configuracao.service';
import { unidadesLaboratoriaisService, categoriasMaterialService, unidadesService } from '@/services/catalogos.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { UTILIZADOR_TIPO_LABELS, ACTIVIDADE_TIPO_LABELS } from '@/services/enums';
import type { UtilizadorTipo, ActividadeTipo } from '@/services/enums';
import type { FluxoEtapaUpsert } from '@/types/configuracao.types';
import type { CatalogoGet } from '@/types/catalogo.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';
import { ALL_ROLES, hasRole } from '@/utils/roleGuard';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2, ArrowUp, ArrowDown, FlaskConical, Tags, Ruler, Settings, Circle, AlertTriangle } from 'lucide-react';

type CatalogoService = typeof unidadesLaboratoriaisService;

function CatalogoPainel({ titulo, service, icon }: { titulo: string; service: CatalogoService; icon: typeof FlaskConical }) {
  const [itens, setItens] = useState<CatalogoGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogoGet | null>(null);
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [paraRemover, setParaRemover] = useState<CatalogoGet | null>(null);

  const load = () => service.list().then(setItens).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openForm = (item?: CatalogoGet) => {
    setEditing(item ?? null);
    setNome(item?.nome ?? '');
    setOpen(true);
  };

  const guardar = async () => {
    if (!nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      if (editing) await service.update(editing.id, { nome: nome.trim() });
      else await service.create({ nome: nome.trim() });
      toast.success(editing ? 'Registo atualizado com sucesso' : 'Registo criado com sucesso');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const remover = async () => {
    if (!paraRemover) return;
    try {
      await service.remove(paraRemover.id);
      toast.success('Registo removido');
      setParaRemover(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {(() => { const Icon = icon; return <Icon className="h-4 w-4" />; })()}
          {titulo}
        </CardTitle>
        <Button size="sm" onClick={() => openForm()}>
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex h-24 items-center justify-center"><Spinner /></div>
        ) : itens.length === 0 ? (
          <div className="p-4"><EmptyState icon={Circle} title="Sem registos" /></div>
        ) : (
          <div className="divide-y">
            {itens.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-medium">{item.nome}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => openForm(item)}>Editar</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setParaRemover(item)}>Remover</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Novo'} — {titulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-catalogo">Nome</Label>
              <Input id="nome-catalogo" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : null}
              {editing ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!paraRemover}
        onOpenChange={(v) => !v && setParaRemover(null)}
        title="Remover registo"
        description={`Pretende remover "${paraRemover?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={remover}
      />
    </Card>
  );
}

const TIPOS_LIMITE: ActividadeTipo[] = ['aula', 'visita', 'projecto', 'estagio'];

interface LimiteForm {
  tipo: ActividadeTipo;
  min: string;
  max: string;
  limite_activo: boolean;
}

function LimitesParticipantesPainel({ podeEditar }: { podeEditar: boolean }) {
  const [form, setForm] = useState<LimiteForm[]>([]);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erros, setErros] = useState<Record<string, { min?: string; max?: string }>>({});

  const load = () => {
    setLoading(true);
    Promise.all([configuracaoService.getLimites(), laboratoriosService.list()])
      .then(([rows, ls]) => {
        setLabs(ls);
        setForm(
          TIPOS_LIMITE.map((tipo) => {
            const r = rows.find((x) => x.tipo === tipo);
            return { tipo, min: String(r?.min ?? 1), max: String(r?.max ?? 40), limite_activo: r?.limite_activo ?? false };
          })
        );
      })
      .catch(() => toast.error('Erro ao carregar os limites de participantes'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setRow = (tipo: ActividadeTipo, patch: Partial<LimiteForm>) =>
    setForm((prev) => prev.map((r) => (r.tipo === tipo ? { ...r, ...patch } : r)));

  const validar = (rows: LimiteForm[]) => {
    const e: Record<string, { min?: string; max?: string }> = {};
    for (const r of rows) {
      const min = Number(r.min);
      const max = Number(r.max);
      const item: { min?: string; max?: string } = {};
      if (!Number.isInteger(min) || min < 1) item.min = 'Mínimo ≥ 1';
      if (!Number.isInteger(max) || max < 1) item.max = 'Máximo ≥ 1';
      if (!item.min && !item.max && min > max) item.max = 'Máximo ≥ mínimo';
      if (item.min || item.max) e[r.tipo] = item;
    }
    return e;
  };

  const guardar = async () => {
    const e = validar(form);
    setErros(e);
    if (Object.keys(e).length > 0) {
      toast.error('Corrija os valores inválidos antes de guardar');
      return;
    }
    setSaving(true);
    try {
      await configuracaoService.updateLimites(
        form.map((r) => ({ id: 0, tipo: r.tipo, min: Number(r.min), max: Number(r.max), limite_activo: r.limite_activo }))
      );
      toast.success('Limites de participantes atualizados');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar os limites');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6"><Spinner /></CardContent></Card>;

  const avisos = form
    .filter((r) => r.limite_activo)
    .flatMap((r) => {
      const min = Number(r.min);
      if (!Number.isInteger(min) || min < 1) return [];
      return labs
        .filter((l) => l.capacidade < min)
        .map((l) => `${l.nome} (capacidade ${l.capacidade}) abaixo do mínimo de ${ACTIVIDADE_TIPO_LABELS[r.tipo]} (${min})`);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" /> Limites de Participantes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O máximo de cada sessão é o menor entre o valor configurado e a capacidade do laboratório. Quando um tipo está inactivo, o máximo é a capacidade do laboratório e o mínimo é 1.
        </p>
        {avisos.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="mb-1 flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Laboratórios abaixo do mínimo</p>
            <ul className="list-disc pl-5">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-28">Mínimo</TableHead>
              <TableHead className="w-28">Máximo</TableHead>
              <TableHead className="w-32">Activo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.map((r) => (
              <TableRow key={r.tipo}>
                <TableCell className="font-medium">{ACTIVIDADE_TIPO_LABELS[r.tipo]}</TableCell>
                <TableCell>
                  <NumberInput value={r.min} onValueChange={(v) => setRow(r.tipo, { min: v })} allowDecimal={false} min={1} disabled={!podeEditar} className="w-24" />
                  {erros[r.tipo]?.min && <p className="mt-1 text-xs text-destructive">{erros[r.tipo].min}</p>}
                </TableCell>
                <TableCell>
                  <NumberInput value={r.max} onValueChange={(v) => setRow(r.tipo, { max: v })} allowDecimal={false} min={1} disabled={!podeEditar} className="w-24" />
                  {erros[r.tipo]?.max && <p className="mt-1 text-xs text-destructive">{erros[r.tipo].max}</p>}
                </TableCell>
                <TableCell>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={r.limite_activo} onCheckedChange={(v) => setRow(r.tipo, { limite_activo: Boolean(v) })} disabled={!podeEditar} />
                    {r.limite_activo ? 'Activo' : 'Inactivo'}
                  </label>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {podeEditar && (
          <div className="flex justify-end">
            <Button onClick={guardar} disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Guardar limites</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegrasAgendamentoPainel() {
  const [permitirFimSemana, setPermitirFimSemana] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setErro(null);
    configuracaoService
      .getGeral()
      .then((c) => setPermitirFimSemana(c.permitir_fim_semana))
      .catch((err) => setErro(err instanceof Error ? err.message : 'Erro ao carregar as regras de agendamento'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const guardar = async () => {
    setSaving(true);
    try {
      const updated = await configuracaoService.updateGeral({ permitir_fim_semana: permitirFimSemana });
      setPermitirFimSemana(updated.permitir_fim_semana);
      toast.success('Regras de agendamento atualizadas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar as regras de agendamento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6"><Spinner /></CardContent></Card>;
  if (erro) return <Card><CardContent className="p-6"><ErrorState title="Erro ao carregar as regras de agendamento" message={erro} onRetry={load} /></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" /> Regras de agendamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="permitir-fim-semana">Permitir agendamentos ao sábado e ao domingo</Label>
            <p className="text-xs text-muted-foreground">
              Só afecta pedidos novos (criação/edição de sessões). Sessões já existentes não são alteradas.
            </p>
          </div>
          <Switch id="permitir-fim-semana" checked={permitirFimSemana} onCheckedChange={setPermitirFimSemana} />
        </div>
        <div className="flex justify-end">
          <Button onClick={guardar} disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Guardar regras</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Configuracao() {
  const { user } = useAuth();
  const podeEditar = hasRole(user?.tipo, ['admin']);
  const [etapas, setEtapas] = useState<FluxoEtapaUpsert[]>([]);
  const [fluxoLoading, setFluxoLoading] = useState(true);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadFluxo = () => configuracaoService.getFluxo().then(setEtapas).finally(() => setFluxoLoading(false));
  useEffect(() => { loadFluxo(); }, []);

  const setEtapasNorm = (updater: (prev: FluxoEtapaUpsert[]) => FluxoEtapaUpsert[]) => {
    setEtapas((prev) => updater(prev).map((e, idx) => ({ ...e, ordem: idx + 1 })));
  };

  const patch = (i: number, patch2: Partial<FluxoEtapaUpsert>) => {
    setEtapasNorm((e) => e.map((x, idx) => (idx === i ? { ...x, ...patch2 } : x)));
  };

  const mover = (i: number, dir: -1 | 1) => {
    setEtapasNorm((e) => {
      const j = i + dir;
      if (j < 0 || j >= e.length) return e;
      const next = [...e];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const toggleCargo = (i: number, cargo: UtilizadorTipo) => {
    setEtapasNorm((e) =>
      e.map((x, idx) => {
        if (idx !== i) return x;
        const has = x.cargos.includes(cargo);
        return has ? { ...x, cargos: x.cargos.filter((c) => c !== cargo) } : { ...x, cargos: [...x.cargos, cargo] };
      })
    );
  };

  const removerEtapa = (i: number) => {
    setEtapasNorm((e) => e.filter((_, idx) => idx !== i));
  };

  const adicionarEtapa = () => {
    setEtapasNorm((e) => [...e, { nome: '', ordem: e.length + 1, cargos: ['coordenador_dlab'] }]);
  };

  const guardarFluxo = async () => {
    if (etapas.some((e) => !e.nome.trim())) {
      toast.error('Todas as etapas precisam de um nome');
      return;
    }
    if (new Set(etapas.map((e) => e.ordem)).size !== etapas.length) {
      toast.error('As ordens têm de ser únicas');
      return;
    }
    if (etapas.some((e) => e.cargos.length === 0)) {
      toast.error('Cada etapa precisa de pelo menos um cargo que aprove');
      return;
    }
    setSavingFluxo(true);
    try {
      const atualizado = await configuracaoService.updateFluxo({ itens: etapas });
      setEtapas(atualizado);
      toast.success('Fluxo de aprovação atualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar o fluxo');
    } finally {
      setSavingFluxo(false);
    }
  };

  const resetFluxo = async () => {
    setSavingFluxo(true);
    try {
      const atualizado = await configuracaoService.resetFluxo();
      setEtapas(atualizado);
      toast.success('Fluxo reposto ao padrão DLab → Supervisor');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao repor o fluxo padrão');
    } finally {
      setSavingFluxo(false);
      setConfirmReset(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Configuração"
        description="Gestão do fluxo de aprovação e dos catálogos do sistema."
      />

      <Tabs defaultValue="fluxo">
        <TabsList className="mb-4">
          <TabsTrigger value="fluxo">Fluxo de Aprovação</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          <TabsTrigger value="limites">Limites de Participantes</TabsTrigger>
          <TabsTrigger value="regras">Regras de agendamento</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" /> Etapas de aprovação
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>Repor padrão</Button>
                <Button size="sm" variant="outline" onClick={adicionarEtapa}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar etapa
                </Button>
                <Button size="sm" onClick={guardarFluxo} disabled={savingFluxo || fluxoLoading}>
                  {savingFluxo ? <Spinner className="mr-2" /> : null}
                  Guardar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {fluxoLoading ? (
                <div className="flex h-24 items-center justify-center"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargos que aprovam</TableHead>
                      <TableHead className="w-16 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etapas.map((etapa, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => mover(i, -1)} disabled={i === 0}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => mover(i, 1)} disabled={i === etapas.length - 1}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input value={etapa.nome} onChange={(e) => patch(i, { nome: e.target.value })} placeholder="ex.: dlab" className="w-40 font-mono" />
                        </TableCell>
                        <TableCell>
                          <div className="grid max-w-xl grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                            {ALL_ROLES.map((cargo) => (
                              <label key={cargo} className="flex cursor-pointer items-center gap-2 text-xs">
                                <Checkbox checked={etapa.cargos.includes(cargo)} onCheckedChange={() => toggleCargo(i, cargo)} />
                                <span>{UTILIZADOR_TIPO_LABELS[cargo]}</span>
                              </label>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removerEtapa(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <p className="mt-3 text-xs text-muted-foreground">
            As alterações afectam os novos processos de aprovação. Os agendamentos já em curso mantêm a etapa actual até concluírem.
          </p>
        </TabsContent>

        <TabsContent value="catalogos" className="space-y-6">
          <CatalogoPainel titulo="Unidades Laboratoriais" icon={FlaskConical} service={unidadesLaboratoriaisService} />
          <CatalogoPainel titulo="Categorias de Material" icon={Tags} service={categoriasMaterialService} />
          <CatalogoPainel titulo="Unidades de Medida" icon={Ruler} service={unidadesService} />
        </TabsContent>

        <TabsContent value="limites">
          <LimitesParticipantesPainel podeEditar={podeEditar} />
        </TabsContent>

        <TabsContent value="regras">
          <RegrasAgendamentoPainel />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Repor fluxo padrão"
        description="Pretende repor o fluxo de aprovação para o padrão DLab → Supervisor? As etapas atuais deixam de estar ativas."
        confirmLabel="Repor"
        variant="destructive"
        onConfirm={resetFluxo}
      />
    </div>
  );
}