import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cursosService } from '@/services/cursos.service';
import type { DisciplinaGet, DisciplinaUpsert } from '@/types/disciplina.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disciplina?: DisciplinaGet | null;
  onSaved: () => void;
}

export function DisciplinaUpsertModal({ open, onOpenChange, disciplina, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(disciplina?.nome ?? '');
  const [disciplinas, setDisciplinas] = useState<DisciplinaGet[]>([]);

  useEffect(() => {
    cursosService.listDisciplinas().then(setDisciplinas);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) setNome(disciplina?.nome ?? '');
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) { toast.error('Indique o nome da disciplina'); return; }
    const duplicado = disciplinas.some((d) => d.id !== disciplina?.id && d.nome.toLowerCase() === nomeTrim.toLowerCase());
    if (duplicado) { toast.error('Já existe uma disciplina com este nome'); return; }
    setSaving(true);
    try {
      const data: DisciplinaUpsert = { nome: nomeTrim };
      if (disciplina) {
        await cursosService.updateDisciplina(disciplina.id, data);
        toast.success('Disciplina atualizada');
      } else {
        await cursosService.createDisciplina(data);
        toast.success('Disciplina criada');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao guardar disciplina');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{disciplina ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}{disciplina ? 'Guardar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
