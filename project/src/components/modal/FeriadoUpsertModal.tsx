import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { DateField } from '@/components/ui/date-field';
import { configuracaoService } from '@/services/configuracao.service';
import { FERIADO_TIPO_OPTIONS } from '@/utils/constants';
import { fmtBR } from '@/utils/dateInput';
import type { FeriadoAfectadoResposta, FeriadoGet, FeriadoTipo } from '@/types/configuracao.types';

interface FeriadoUpsertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feriado?: FeriadoGet | null;
  onSaved: () => void;
}

export function FeriadoUpsertModal({ open, onOpenChange, feriado, onSaved }: FeriadoUpsertModalProps) {
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [tipo, setTipo] = useState<FeriadoTipo>('feriado');
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<FeriadoAfectadoResposta | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(feriado?.nome ?? '');
    setData(feriado?.data?.slice(0, 10) ?? '');
    setTipo(feriado?.tipo ?? 'feriado');
    setResultado(null);
  }, [open, feriado]);

  const guardar = async () => {
    if (!nome.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    if (!data) {
      toast.error('A data é obrigatória');
      return;
    }
    setSaving(true);
    try {
      const res = feriado
        ? await configuracaoService.updateFeriado(feriado.id, { nome: nome.trim(), data, tipo })
        : await configuracaoService.createFeriado({ nome: nome.trim(), data, tipo });
      toast.success(feriado ? 'Feriado actualizado' : 'Feriado registado');
      onSaved();
      if ((res.sessoes_afectadas_count ?? 0) > 0) {
        setResultado(res);
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar o feriado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{feriado ? 'Editar feriado' : 'Novo feriado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="feriado-nome">Nome</Label>
              <Input
                id="feriado-nome"
                value={nome}
                maxLength={100}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex.: Dia da Independência"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feriado-data">Data</Label>
              <DateField id="feriado-data" value={data} onChange={setData} />
              <p className="text-xs text-muted-foreground">
                Um feriado anual (tipo «Feriado») repete-se todos os anos no mesmo dia/mês.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as FeriadoTipo)}>
                <SelectTrigger>
                  <SelectValue>{FERIADO_TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? tipo}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FERIADO_TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={guardar} disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : null}
              {feriado ? 'Guardar' : 'Registar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resultado} onOpenChange={(v) => { if (!v) setResultado(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sessões afectadas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O feriado foi guardado. As seguintes sessões futuras ({resultado?.sessoes_afectadas_count ?? 0}) caem nesta data
            {tipo === 'feriado' ? ' (ou no mesmo dia/mês de anos seguintes)' : ''}. As sessões existentes não são canceladas
            automaticamente.
          </p>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {(resultado?.actividades_afectadas ?? []).map((a) => (
              <div key={a.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">{a.nome}</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  {(a.sessoes ?? []).map((s) => (
                    <li key={s.agendamento_id}>{fmtBR(s.data)} — sessão #{s.agendamento_id}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => { setResultado(null); onOpenChange(false); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
