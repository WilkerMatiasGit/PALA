import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { AlertTriangle, Mail, Lock } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email, senha });
      navigate('/inicio');
    } catch {
      setError('Credenciais inválidas. Verifique o email e a senha.');
    }
  };

  const quickLogins: { label: string; email: string }[] = [
    { label: 'Admin', email: 'cpereira@isptec.co.ao' },
    { label: 'Professor', email: 'jsilva@isptec.co.ao' },
    { label: 'Técnico', email: 'amartins@isptec.co.ao' },
    { label: 'Coord. DLab', email: 'msantos@isptec.co.ao' },
    { label: 'Supervisor', email: 'rfernandes@isptec.co.ao' },
    { label: 'Chefe Dept.', email: 'scosta@isptec.co.ao' },
  ];

  const quickLogin = async (accEmail: string) => {
    setError('');
    setEmail(accEmail);
    setSenha('12345678');
    try {
      await login({ email: accEmail, senha: '12345678' });
      navigate('/inicio');
    } catch {
      setError('Credenciais inválidas. Verifique o email e a senha.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email institucional</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email" type="email" required
            className="pl-9" placeholder="nome@isptec.co.ao"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="senha" type="password" required
            className="pl-9" placeholder="••••••••"
            value={senha} onChange={(e) => setSenha(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (<><Spinner className="mr-2" /> A entrar...</>) : 'Entrar'}
      </Button>

      {import.meta.env.DEV && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Acesso rápido (dev)</p>
          <div className="flex flex-wrap gap-2">
            {quickLogins.map((q) => (
              <Button key={q.email} type="button" variant="outline" size="sm" disabled={loading} onClick={() => quickLogin(q.email)}>
                {q.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Demo: senha por defeito dos utilizadores criados é <code className="rounded bg-muted px-1">12345678</code>.
      </p>
    </form>
  );
}
