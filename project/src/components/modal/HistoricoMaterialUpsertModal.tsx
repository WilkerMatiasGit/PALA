import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { movimentacoesService } from '@/services/movimentacoes.service';
import { materiaisService } from '@/services/materiais.service';
import { useAuth } from '@/context/AuthContext';
import { MOVIMENTACAO_MOTIVO_OPTIONS } from '@/services/enums';
import type { MaterialGet, HistoricoMaterialUpsert } from '@/types/material.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialGet | null;
  onSaved: () => void;
}

export function HistoricoMaterialUpsertModal({ open, onOpenChange, material, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState<HistoricoMaterialUpsert['motivo']>('ajuste_inventario');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [materiais, setMateriais] = useState<MaterialGet[]>([]);
  const [materialId, setMaterialId] = useState(material ? String(material.id) : '');

  useEffect(() => { materiaisService.list().then(setMateriais); }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setQuantidade(''); setMotivo('ajuste_inventario'); setDescricao(''); setTipo('entrada');
      setMaterialId(material ? String(material.id) : '');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!descricao.trim()) { toast.error('A justificação é obrigatória'); return; }
    const matId = material ? material.id : Number(materialId);
    if (!matId) { toast.error('Selecione um material'); return; }
    setSaving(true);
    try {
      const qtd = Number(quantidade);
      const data: HistoricoMaterialUpsert = {
        material_id: matId,
        utilizador_id: user.id,
        quantidade_movimentada: tipo === 'entrada' ? qtd : -qtd,
        motivo,
        descricao,
      };
      await movimentacoesService.create(data);
      toast.success('Movimentação registada');
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao registar movimentação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registar Movimentação{material ? ` - ${material.nome}` : ''}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!material && (
            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue placeholder="Selecionar material" /></SelectTrigger>
                <SelectContent>{materiais.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tipo de operação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as 'entrada' | 'saida')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (+)</SelectItem>
                <SelectItem value="saida">Saída (-)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hist-qtd">Quantidade</Label>
            <NumberInput id="hist-qtd" required value={quantidade} onValueChange={setQuantidade} />
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as typeof motivo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MOVIMENTACAO_MOTIVO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hist-desc">Justificação detalhada *</Label>
            <Textarea id="hist-desc" required value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Descreva o motivo da alteração..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Registar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
