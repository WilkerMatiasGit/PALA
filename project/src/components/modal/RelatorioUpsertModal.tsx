import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { relatoriosService } from '@/services/relatorios.service';
import { laboratoriosService } from '@/services/laboratorios.service';
import { MESES } from '@/utils/constants';
import type { LaboratorioGet } from '@/types/laboratorio.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RelatorioUpsertModal({ open, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);
  const [labId, setLabId] = useState('');
  const [mes, setMes] = useState('6');
  const [ano, setAno] = useState('2026');

  useEffect(() => { laboratoriosService.list().then(setLabs); }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) { setLabId(''); setMes('6'); setAno('2026'); }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) { toast.error('Selecione um laboratório'); return; }
    setSaving(true);
    try {
      await relatoriosService.create({ laboratorio_id: Number(labId), mes: Number(mes), ano: Number(ano) });
      toast.success('Relatório gerado');
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao gerar relatório');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar Relatório</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Laboratório</Label>
            <Select value={labId} onValueChange={setLabId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>{labs.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano">Ano</Label>
              <NumberInput id="ano" allowDecimal={false} required value={ano} onValueChange={setAno} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Gerar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
