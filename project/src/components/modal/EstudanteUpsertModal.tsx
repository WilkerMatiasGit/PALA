import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cursosService } from '@/services/cursos.service';
import type { EstudanteGet, EstudanteUpsert } from '@/types/estudantes.types';
import type { CursoGet } from '@/types/curso.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estudante?: EstudanteGet | null;
  onSaved: () => void;
}

export function EstudanteUpsertModal({ open, onOpenChange, estudante, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState(estudante?.nome ?? '');
  const [cursoId, setCursoId] = useState(estudante ? String(estudante.curso_id) : '');
  const [cursos, setCursos] = useState<CursoGet[]>([]);
  const [estudantes, setEstudantes] = useState<EstudanteGet[]>([]);

  useEffect(() => {
    cursosService.listCursos().then(setCursos);
    cursosService.listEstudantes().then(setEstudantes);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setMatricula(estudante ? String(estudante.id) : '');
      setNome(estudante?.nome ?? '');
      setCursoId(estudante ? String(estudante.curso_id) : '');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoId) { toast.error('Selecione um curso'); return; }
    if (!estudante && !matricula) { toast.error('Indique o número de matrícula'); return; }
    const matriculaNum = Number(matricula);
    if (!estudante && (!Number.isInteger(matriculaNum) || matriculaNum <= 0)) { toast.error('Número de matrícula inválido'); return; }
    if (!estudante && estudantes.some((e) => e.id === matriculaNum)) { toast.error('Já existe um estudante com este número de matrícula'); return; }
    setSaving(true);
    try {
      const data: EstudanteUpsert = { id: estudante ? estudante.id : matriculaNum, nome, curso_id: Number(cursoId) };
      if (estudante) {
        await cursosService.updateEstudante(estudante.id, data);
        toast.success('Estudante atualizado');
      } else {
        await cursosService.createEstudante(data);
        toast.success('Estudante criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao guardar estudante');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{estudante ? 'Editar Estudante' : 'Novo Estudante'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="matricula">Nº de matrícula</Label>
            <Input id="matricula" type="number" disabled={!!estudante} required={!estudante} value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Curso</Label>
            <Select value={cursoId} onValueChange={setCursoId}>
              <SelectTrigger><SelectValue placeholder="Selecionar curso" /></SelectTrigger>
              <SelectContent>{cursos.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}{estudante ? 'Guardar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
