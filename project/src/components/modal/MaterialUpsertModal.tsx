import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { materiaisService } from '@/services/materiais.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { MATERIAL_CATEGORIA_OPTIONS, MATERIAL_ESTADO_OPTIONS } from '@/services/enums';
import type { MaterialGet, MaterialUpsert } from '@/types/material.types';
import type { LaboratorioGet } from '@/types/laboratorio.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: MaterialGet | null;
  onSaved: () => void;
}

export function MaterialUpsertModal({ open, onOpenChange, material, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [nome, setNome] = useState(material?.nome ?? '');
  const [labId, setLabId] = useState(material ? String(material.laboratorio_id) : '');
  const [categoria, setCategoria] = useState(material?.categoria ?? 'equipamento');
  const [quantidadeMinima, setQuantidadeMinima] = useState(material ? String(material.quantidade_minima) : '0');
  const [unidade, setUnidade] = useState(material?.unidade ?? 'un');
  const [estado, setEstado] = useState(material?.estado ?? 'disponivel');
  const [quantidadeInicial, setQuantidadeInicial] = useState('0');
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);

  useEffect(() => { laboratoriosService.list().then(setLabs); materiaisService.list().then(setMateriais); }, []);
  useEffect(() => { setLabId(material ? String(material.laboratorio_id) : ''); }, [material]);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(material?.nome ?? '');
      setLabId(material ? String(material.laboratorio_id) : '');
      setCategoria(material?.categoria ?? 'equipamento');
      setQuantidadeMinima(material ? String(material.quantidade_minima) : '0');
      setUnidade(material?.unidade ?? 'un');
      setEstado(material?.estado ?? 'disponivel');
      setQuantidadeInicial('0');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) { toast.error('Selecione um laboratório'); return; }
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
    } catch {
      toast.error('Erro ao guardar material');
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
              <Select value={categoria} onValueChange={(v) => setCategoria(v as typeof categoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIAL_CATEGORIA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
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
              <Input id="mat-min" type="number" min={0} value={quantidadeMinima} onChange={(e) => setQuantidadeMinima(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-uni">Unidade</Label>
              <Input id="mat-uni" required value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, ml, g, L..." />
            </div>
          </div>
          {!material && (
            <div className="space-y-2">
              <Label htmlFor="mat-ini">Stock inicial (1ª movimentação)</Label>
              <Input id="mat-ini" type="number" value={quantidadeInicial} onChange={(e) => setQuantidadeInicial(e.target.value)} />
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
