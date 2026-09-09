import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cursosService } from '@/services/cursos.service';
import { DEPARTAMENTO_OPTIONS } from '@/services/enums';
import type { CursoGet, CursoUpsert } from '@/types/curso.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curso?: CursoGet | null;
  onSaved: () => void;
}

export function CursoUpsertModal({ open, onOpenChange, curso, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(curso?.nome ?? '');
  const [departamento, setDepartamento] = useState(curso?.departamento ?? 'DET');
  const [abreviacao, setAbreviacao] = useState(curso?.abreviacao ?? '');
  const [cursos, setCursos] = useState<CursoGet[]>([]);

  useEffect(() => { cursosService.listCursos().then(setCursos); }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(curso?.nome ?? '');
      setDepartamento(curso?.departamento ?? 'DET');
      setAbreviacao(curso?.abreviacao ?? '');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) { toast.error('Indique o nome do curso'); return; }
    const duplicado = cursos.some((c) => c.id !== curso?.id && c.nome.toLowerCase() === nomeTrim.toLowerCase());
    if (duplicado) { toast.error('Já existe um curso com este nome'); return; }
    setSaving(true);
    try {
      const data: CursoUpsert = { nome: nomeTrim, departamento, abreviacao };
      if (curso) {
        await cursosService.updateCurso(curso.id, data);
        toast.success('Curso atualizado');
      } else {
        await cursosService.createCurso(data);
        toast.success('Curso criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao guardar curso');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{curso ? 'Editar Curso' : 'Novo Curso'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departamento} onValueChange={(v) => setDepartamento(v as typeof departamento)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTAMENTO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="abreviacao">Abreviação</Label>
            <Input id="abreviacao" required value={abreviacao} onChange={(e) => setAbreviacao(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}{curso ? 'Guardar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
