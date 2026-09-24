import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { SearchSelect } from '@/components/ui/search-select';
import { materiaisService } from '@/services/materiais.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { categoriasMaterialService, unidadesService } from '@/services/catalogos.service';
import { MATERIAL_ESTADO_OPTIONS } from '@/services/enums';
import { useAuth } from '@/context/AuthContext';
import type { MaterialGet, MaterialUpsert } from '@/types/material.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: MaterialGet | null;
  onSaved: () => void;
}

export function MaterialUpsertModal({ open, onOpenChange, material, onSaved }: Props) {
  const { user } = useAuth();
  const canCreateCatalogo = user?.tipo === 'admin';
  const [saving, setSaving] = useState(false);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [nome, setNome] = useState(material?.nome ?? '');
  const [labId, setLabId] = useState(material ? String(material.laboratorio_id) : '');
  const [categoria, setCategoria] = useState(material?.categoria ?? '');
  const [quantidadeMinima, setQuantidadeMinima] = useState(material ? String(material.quantidade_minima) : '0');
  const [unidade, setUnidade] = useState(material?.unidade ?? '');
  const [estado, setEstado] = useState(material?.estado ?? 'disponivel');
  const [quantidadeInicial, setQuantidadeInicial] = useState('0');
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [categorias, setCategorias] = useState<{ value: string; label: string }[]>([]);
  const [unidades, setUnidades] = useState<{ value: string; label: string }[]>([]);

  const loadCatalogos = async () => {
    const [cats, unis] = await Promise.all([categoriasMaterialService.list(), unidadesService.list()]);
    setCategorias(cats.map((c) => ({ value: c.nome, label: c.nome })));
    setUnidades(unis.map((u) => ({ value: u.nome, label: u.nome })));
  };

  useEffect(() => {
    laboratoriosService.list().then(setLabs).catch(() => {});
    materiaisService.list().then(setMateriais).catch(() => {});
    loadCatalogos().catch(() => {});
  }, []);

  useEffect(() => { setLabId(material ? String(material.laboratorio_id) : ''); }, [material]);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(material?.nome ?? '');
      setLabId(material ? String(material.laboratorio_id) : '');
      setCategoria(material?.categoria ?? '');
      setQuantidadeMinima(material ? String(material.quantidade_minima) : '0');
      setUnidade(material?.unidade ?? '');
      setEstado(material?.estado ?? 'disponivel');
      setQuantidadeInicial('0');
    }
    onOpenChange(v);
  };

  const handleCreateCategoria = async (nomeCat: string) => {
    await categoriasMaterialService.create({ nome: nomeCat });
    await loadCatalogos();
    toast.success(`Categoria "${nomeCat}" criada`);
  };

  const handleCreateUnidade = async (nomeUni: string) => {
    await unidadesService.create({ nome: nomeUni });
    await loadCatalogos();
    toast.success(`Unidade "${nomeUni}" criada`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) { toast.error('Selecione um laboratório'); return; }
    if (!categoria) { toast.error('Selecione a categoria'); return; }
    if (!unidade) { toast.error('Indique a unidade'); return; }
    const nomeTrim = nome.trim();
    const labNum = Number(labId);
    const duplicado = materiais.some((m) => m.id !== material?.id && m.laboratorio_id === labNum && m.nome.toLowerCase() === nomeTrim.toLowerCase());
    if (duplicado) { toast.error('Já existe um material com este nome neste laboratório'); return; }
    setSaving(true);
    try {
      const data: MaterialUpsert = {
        nome: nomeTrim, laboratorio_id: labNum, categoria,
        quantidade_minima: Number(quantidadeMinima), unidade, estado,
        ...(material ? {} : { quantidade_inicial: Number(quantidadeInicial) }),
      };
      if (material) {
        await materiaisService.update(material.id, data);
        toast.success('Material atualizado');
      } else {
        await materiaisService.create(data);
        toast.success('Material criado');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{material ? 'Editar Material' : 'Novo Material'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mat-nome">Nome</Label>
            <Input id="mat-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Laboratório</Label>
            <Select value={labId} onValueChange={setLabId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>{labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <SearchSelect
                value={categoria}
                onValueChange={setCategoria}
                options={categorias}
                placeholder="Selecionar categoria..."
                canCreate={canCreateCatalogo}
                onCreate={handleCreateCategoria}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIAL_ESTADO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mat-min">Quantidade mínima</Label>
              <NumberInput id="mat-min" min={0} value={quantidadeMinima} onValueChange={setQuantidadeMinima} />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <SearchSelect
                value={unidade}
                onValueChange={setUnidade}
                options={unidades}
                placeholder="un, ml, g, L..."
                canCreate={canCreateCatalogo}
                onCreate={handleCreateUnidade}
              />
            </div>
          </div>
          {!material && (
            <div className="space-y-2">
              <Label htmlFor="mat-ini">Stock inicial (1ª movimentação)</Label>
              <NumberInput id="mat-ini" value={quantidadeInicial} onValueChange={setQuantidadeInicial} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}{material ? 'Guardar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}