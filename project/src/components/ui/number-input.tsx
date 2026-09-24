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

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  onValueChange: (value: string) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
}

export function NumberInput({
  value,
  onValueChange,
  allowNegative,
  allowDecimal,
  className,
  ...props
}: NumberInputProps) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value ?? ''}
      onChange={(e) => onValueChange(sanitizeNumber(e.target.value, { allowNegative, allowDecimal }))}
      className={cn(className)}
      {...props}
    />
  );
}