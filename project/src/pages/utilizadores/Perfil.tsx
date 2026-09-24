import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/context/AuthContext';
import { utilizadoresService } from '@/services/utilizadores.service';
import { UTILIZADOR_TIPO_LABELS } from '@/services/enums';
import type { UtilizadorGet } from '@/types/utilizador.types';
import { Lock, AlertTriangle } from 'lucide-react';

export default function Perfil() {
  const { user } = useAuth();
  const [utilizador, setUtilizador] = useState<UtilizadorGet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [senhaActual, setSenhaActual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    utilizadoresService.getMe()
    .then(setUtilizador)
    .finally(() => setLoading(false));
  }, [user]);

  const handleSave = () => {
    if (!novaSenha) {
      setError('Indique a nova senha para alterar.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!senhaActual) {
      setError('Indique a senha actual para poder alterar.');
      return;
    }
    setError('');
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    if (!utilizador) return;
    setSaving(true);
    try {
      await utilizadoresService.changePassword(utilizador.id, {
        senha: novaSenha,
        senha_actual: senhaActual,
      });
      toast.success('Senha atualizada com sucesso');
      setSenhaActual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar senha');
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  if (loading) return <div className="flex h-60 items-center justify-center"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Meu Perfil" description="Gestão dos seus dados pessoais e senha de acesso." />

      <div className="max-w-2xl">
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                {utilizador?.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold">{utilizador?.nome}</p>
                <p className="text-sm text-muted-foreground">{utilizador?.email}</p>
                <Badge variant="secondary" className="mt-1">
                  {utilizador ? UTILIZADOR_TIPO_LABELS[utilizador.tipo] : ''}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={utilizador?.nome ?? ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Email (bloqueado)</Label>
              <Input value={utilizador?.email ?? ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Tipo / Cargo (apenas Admin pode alterar)</Label>
              <Input value={utilizador ? UTILIZADOR_TIPO_LABELS[utilizador.tipo] : ''} disabled className="bg-muted" />
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4" /> Alterar Senha
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="senha-actual">Senha actual</Label>
                  <Input id="senha-actual" type="password" value={senhaActual} onChange={(e) => setSenhaActual(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input id="nova-senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha">Confirmar senha</Label>
                  <Input id="confirmar-senha" type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving || !novaSenha}>
                {saving ? <Spinner className="mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirmar alterações"
        description="Pretende guardar as alterações ao seu perfil?"
        confirmLabel="Confirmar"
        onConfirm={confirmSave}
      />
    </div>
  );
}
