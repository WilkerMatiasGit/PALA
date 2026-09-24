import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { utilizadoresService } from '@/services/utilizadores.service';
import type { UtilizadorGet } from '@/types/utilizador.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  utilizador: UtilizadorGet | null;
  onSaved: () => void;
}

export function ResetPasswordModal({ open, onOpenChange, utilizador, onSaved }: Props) {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setNovaSenha('');
      setConfirmar('');
    }
    onOpenChange(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenha) { toast.error('Indique a nova palavra-passe'); return; }
    if (novaSenha !== confirmar) { toast.error('As palavras-passe não coincidem'); return; }
    if (!utilizador) return;
    setSaving(true);
    try {
      await utilizadoresService.resetPassword({ id: utilizador.id, nova_senha: novaSenha });
      toast.success(`Palavra-passe de ${utilizador.nome} reposta`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao repor a palavra-passe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repor palavra-passe</DialogTitle>
          <DialogDescription>
            Definir nova palavra-passe para {utilizador?.nome}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova palavra-passe</Label>
            <Input id="nova-senha" type="password" required value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar-senha">Confirmar palavra-passe</Label>
            <Input id="confirmar-senha" type="password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner className="mr-2" /> : null}Repor</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}