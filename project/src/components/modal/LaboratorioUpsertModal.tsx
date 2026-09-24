import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { SearchSelect } from '@/components/ui/search-select';
import { laboratoriosService } from '@/services/laboratorios.service';
import { unidadesLaboratoriaisService } from '@/services/catalogos.service';
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
  const [tipo, setTipo] = useState(laboratorio?.tipo ?? '');
  const [descricao, setDescricao] = useState(laboratorio?.descricao ?? '');
  const [unidades, setUnidades] = useState<{ value: string; label: string }[]>([]);
  const [labs, setLabs] = useState<LaboratorioGet[]>([]);

  const loadUnidades = async () => {
    const rows = await unidadesLaboratoriaisService.list();
    setUnidades(rows.map((u) => ({ value: u.nome, label: u.nome })));
  };

  useEffect(() => {
    loadUnidades().catch(() => {});
    laboratoriosService.list().then(setLabs).catch(() => {});
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(laboratorio?.nome ?? '');
      setTipo(laboratorio?.tipo ?? '');
      setDescricao(laboratorio?.descricao ?? '');
    }
    onOpenChange(v);
  };

  const handleCreateUnidade = async (novoTipo: string) => {
    await unidadesLaboratoriaisService.create({ nome: novoTipo });
    await loadUnidades();
    toast.success(`Unidade laboratorial "${novoTipo}" criada`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) { toast.error('Indique o nome do laboratório'); return; }
    if (!tipo) { toast.error('Selecione a unidade laboratorial'); return; }
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
            <Label>Unidade Laboratorial</Label>
            <SearchSelect
              value={tipo}
              onValueChange={setTipo}
              options={unidades}
              placeholder="Selecionar unidade..."
              canCreate
              onCreate={handleCreateUnidade}
            />
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