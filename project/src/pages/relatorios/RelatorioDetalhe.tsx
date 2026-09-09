import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { StatCard } from '@/components/dashboard/StatCard';
import { relatoriosService } from '@/services/relatorios.service';
import { monthLabel } from '@/utils/formatDate';
import type { RelatorioGet, RelatorioDadosJson } from '@/types/relatorio.types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, CheckCircle2, Package, FileDown, AlertTriangle } from 'lucide-react';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function RelatorioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [relatorio, setRelatorio] = useState<RelatorioGet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [jsonError, setJsonError] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    relatoriosService.get(Number(id)).then(setRelatorio).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const dados = useMemo<RelatorioDadosJson | null>(() => {
    if (!relatorio) return null;
    try {
      return JSON.parse(relatorio.dados_json) as RelatorioDadosJson;
    } catch {
      setJsonError(true);
      return null;
    }
  }, [relatorio]);

  if (loading) return <FullPageSpinner />;
  if (error || !relatorio) return <ErrorState onRetry={load} />;

  const handleExport = () => {
    relatoriosService.exportarPdf(relatorio.id).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${relatorio.laboratorio_nome}-${relatorio.mes}-${relatorio.ano}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exportado');
    });
  };

  return (
    <div>
      <PageHeader
        title={`Relatório ${relatorio.laboratorio_nome} · ${monthLabel(relatorio.mes, relatorio.ano)}`}
        breadcrumbs={[{ label: 'Relatórios', href: '/relatorios' }, { label: `${relatorio.mes}/${relatorio.ano}` }]}
        action={<Button onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Exportar PDF</Button>}
      />

      {jsonError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Os dados do relatório estão corrompidos ou num formato inválido.</AlertDescription>
        </Alert>
      ) : dados ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Activity} label="Total Actividades" value={dados.total_actividades} color="blue" />
            <StatCard icon={CheckCircle2} label="Realizadas" value={dados.total_realizadas} color="emerald" />
            <StatCard icon={Package} label="Materiais Baixados" value={dados.total_materiais_baixados} color="amber" />
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Actividades por Tipo</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dados.por_tipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" name="Quantidade" radius={[4, 4, 0, 0]}>
                    {dados.por_tipo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
