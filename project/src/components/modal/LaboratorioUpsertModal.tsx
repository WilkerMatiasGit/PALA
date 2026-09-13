import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { laboratoriosService } from '@/services/laboratorios.service';
import { LABORATORIO_TIPO_OPTIONS } from '@/services/enums';
import type { LaboratorioGet, LaboratorioUpsert } from '@/types/laboratorio.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratorio?: LaboratorioGet | null;
  onSaved: () => void;
}

export function LaboratorioUpsertModal({ open, onOpenChange, laboratorio, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(laboratorio?.nome ?? '');
  const [tipo, setTipo] = useState(laboratorio?.tipo ?? 'quimica');
  const [descricao, setDescricao] = useState(laboratorio?.descricao ?? '');
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);

  useEffect(() => { laboratoriosService.list().then(setLabs); }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(laboratorio?.nome ?? '');
      setTipo(laboratorio?.tipo ?? 'quimica');
      setDescricao(laboratorio?.descricao ?? '');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) { toast.error('Indique o nome do laboratório'); return; }
    const duplicado = labs.some((l) => l.id !== laboratorio?.id && l.nome.toLowerCase() === nomeTrim.toLowerCase());
    if (duplicado) { toast.error('Já existe um laboratório com este nome'); return; }
    setSaving(true);
    try {
      const data: LaboratorioUpsert = { nome: nomeTrim, tipo, descricao };
      if (laboratorio) {
        await laboratoriosService.update(laboratorio.id, data);
        toast.success('Laboratório atualizado');
      } else {
        await laboratoriosService.create(data);
        toast.success('Laboratório criado');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar laboratório');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{laboratorio ? 'Editar Laboratório' : 'Novo Laboratório'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LABORATORIO_TIPO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}{laboratorio ? 'Guardar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
