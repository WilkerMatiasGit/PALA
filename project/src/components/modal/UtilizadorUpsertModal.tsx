import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { utilizadoresService } from '@/services/utilizadores.service';
import { UTILIZADOR_TIPO_OPTIONS } from '@/services/enums';
import type { UtilizadorGet, UtilizadorUpsert } from '@/types/utilizador.types';

interface UtilizadorUpsertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  utilizador?: UtilizadorGet | null;
  onSaved: () => void;
}

export function UtilizadorUpsertModal({ open, onOpenChange, utilizador, onSaved }: UtilizadorUpsertModalProps) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState(utilizador?.nome ?? '');
  const [email, setEmail] = useState(utilizador?.email ?? '');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState(utilizador?.tipo ?? 'professor');

  // Reset when modal opens with different data
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNome(utilizador?.nome ?? '');
      setEmail(utilizador?.email ?? '');
      setSenha('');
      setTipo(utilizador?.tipo ?? 'professor');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@isptec\.co\.ao$/.test(email.trim().toLowerCase())) {
      toast.error('O email deve pertencer ao domínio @isptec.co.ao');
      return;
    }
    setSaving(true);
    try {
      const data: UtilizadorUpsert = { nome, email, tipo };
      if (senha) data.senha = senha;
      if (utilizador) {
        await utilizadoresService.update(utilizador.id, data);
        toast.success('Utilizador atualizado com sucesso');
      } else {
        await utilizadoresService.create(data);
        toast.success('Utilizador criado com sucesso');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar utilizador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{utilizador ? 'Editar Utilizador' : 'Novo Utilizador'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">{utilizador ? 'Nova senha (deixar vazio para manter)' : 'Senha'}</Label>
            <Input id="senha" type="password" required={!utilizador} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo / Cargo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UTILIZADOR_TIPO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : null}
              {utilizador ? 'Guardar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
