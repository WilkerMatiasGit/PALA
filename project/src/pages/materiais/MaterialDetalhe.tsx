import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FullPageSpinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StockAlertBadge } from '@/components/ui/stock-alert-badge';
import { HistoricoMaterialUpsertModal } from '@/components/modal/HistoricoMaterialUpsertModal';
import { materiaisService } from '@/services/materiais.service';
import { movimentacoesService } from '@/services/movimentacoes.service';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/utils/roleGuard';
import { MATERIAL_CATEGORIA_LABELS, MOVIMENTACAO_MOTIVO_LABELS } from '@/services/enums';
import { formatMaterialEstado } from '@/utils/formatEstado';
import { formatDate } from '@/utils/formatDate';
import type { MaterialGet, HistoricoMaterialGet } from '@/types/material.types';
import { Package, Minus, History } from 'lucide-react';

export default function MaterialDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canMov = hasRole(user?.tipo, ['admin', 'tecnico', 'supervisor', 'chefe_departamento']);
  const [material, setMaterial] = useState<MaterialGet | null>(null);
  const [historico, setHistorico] = useState<HistoricoMaterialGet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [movOpen, setMovOpen] = useState(false);

  const load = () => {
    if (!id) return;
    const mid = Number(id);
    setLoading(true);
    Promise.all([materiaisService.get(mid), movimentacoesService.listByMaterial(mid)])
      .then(([m, h]) => { setMaterial(m); setHistorico(h); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <FullPageSpinner />;
  if (error || !material) return <ErrorState onRetry={load} />;

  const est = formatMaterialEstado(material.estado);
  const lowStock = material.quantidade <= material.quantidade_minima;

  return (
    <div>
      <PageHeader
        title={material.nome}
        breadcrumbs={[{ label: 'Materiais', href: '/materiais' }, { label: material.nome }]}
        action={canMov ? <Button onClick={() => setMovOpen(true)}><Minus className="mr-2 h-4 w-4" /> Movimentar Stock</Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4" /> Informação do Material</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Laboratório</span><span className="font-medium">{material.laboratorio_nome}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><Badge variant="secondary">{MATERIAL_CATEGORIA_LABELS[material.categoria]}</Badge></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Stock atual</span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${lowStock ? 'text-red-600' : ''}`}>{material.quantidade} {material.unidade}</span>
                {lowStock && <StockAlertBadge quantidade={material.quantidade} minima={material.quantidade_minima} />}
              </div>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quantidade mínima</span><span className="font-medium">{material.quantidade_minima} {material.unidade}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Estado</span><Badge variant="outline" className={est.className}>{est.label}</Badge></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Histórico de Movimentações</CardTitle></CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <EmptyState icon={History} title="Sem movimentações" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Δ</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <Badge variant="outline" className={h.quantidade_movimentada >= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                          {h.quantidade_movimentada >= 0 ? '+' : ''}{h.quantidade_movimentada}
                        </Badge>
                      </TableCell>
                      <TableCell>{MOVIMENTACAO_MOTIVO_LABELS[h.motivo]}</TableCell>
                      <TableCell className="text-muted-foreground">{h.utilizador_nome}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(h.criado_em)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <HistoricoMaterialUpsertModal open={movOpen} onOpenChange={setMovOpen} material={material} onSaved={load} />
    </div>
  );
}
