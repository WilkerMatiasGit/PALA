import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Sanitiza uma string de input para conter apenas dígitos (e, opcionalmente,
// um ponto decimal e/ou sinal negativo). Bloqueia caracteres inválidos em
// tempo-real (ex.: '-1', letras, múltiplos pontos) — §2.13 do PLANO.md.
export function sanitizeNumber(
  raw: string,
  opts: { allowNegative?: boolean; allowDecimal?: boolean } = {}
): string {
  let v = raw;
  const { allowNegative = false, allowDecimal = true } = opts;
  if (!allowNegative) v = v.replace(/-/g, '');
  if (allowDecimal) {
    v = v.replace(/[^\d.]/g, '');
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
  } else {
    v = v.replace(/\D/g, '');
  }
  if (v.startsWith('.') && allowDecimal) v = '0' + v;
  return v;
}

// Aplica limites numéricos em tempo-real: um valor não-vazio abaixo de `min`
// (ou acima de `max`) é ajustado para o limite, impedindo fisicamente digitar
// fora do intervalo (ex.: 0/negativos quando min=1). O vazio é permitido.
function clampNumber(v: string, min?: number, max?: number): string {
  if (v === '') return v;
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  if (min != null && n < min) return String(min);
  if (max != null && n > max) return String(max);
  return v;
}

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'min' | 'max'> {
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
}

export function NumberInput({
  value,
  onValueChange,
  allowNegative,
  allowDecimal,
  min,
  max,
  className,
  ...props
}: NumberInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value ?? ''}
      onChange={(e) =>
        onValueChange(clampNumber(sanitizeNumber(e.target.value, { allowNegative, allowDecimal }), min, max))
      }
      className={cn(className)}
      {...props}
    />
  );
}