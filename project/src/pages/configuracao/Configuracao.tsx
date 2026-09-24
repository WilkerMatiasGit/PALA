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
import { configuracaoService } from '@/services/configuracao.service';
import { unidadesLaboratoriaisService, categoriasMaterialService, unidadesService } from '@/services/catalogos.service';
import { UTILIZADOR_TIPO_LABELS } from '@/services/enums';
import type { UtilizadorTipo } from '@/services/enums';
import type { FluxoEtapaUpsert } from '@/types/configuracao.types';
import type { CatalogoGet } from '@/types/catalogo.types';
import { ALL_ROLES } from '@/utils/roleGuard';
import { Plus, Trash2, ArrowUp, ArrowDown, FlaskConical, Tags, Ruler, Settings, Circle } from 'lucide-react';

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

export default function Configuracao() {
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