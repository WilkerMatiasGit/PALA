import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { deISO, fmtBR, paraISO } from '@/utils/dateInput';

export interface DateFieldProps {
  /** Dia escolhido em 'aaaa-mm-dd' ('' = vazio) — formato de entrada E saída. */
  value: string;
  /** Devolve sempre 'aaaa-mm-dd' (dia de calendário local, sem fuso horário). */
  onChange: (iso: string) => void;
  /** Limite inferior inclusivo, em 'aaaa-mm-dd' (dias anteriores ficam cinzentos). */
  min?: string;
  /** Limite superior inclusivo, em 'aaaa-mm-dd' (dias posteriores ficam cinzentos). */
  max?: string;
  /**
   * Regras próprias de desactivação. Combine-as com `diaDesactivado` de
   * `@/utils/dateInput` (fim de semana, período, …) em vez de as reimplementar.
   */
  isDayDisabled?: (date: Date) => boolean;
  disabled?: boolean;
  /** Indicação de erro: borda vermelha + aria-invalid. */
  invalid?: boolean;
  /** Texto mostrado quando `value` está vazio. */
  placeholder?: string;
  'aria-label'?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

/**
 * Seletor de data partilhado (Popover + Calendar/react-day-picker, pt-BR).
 *
 * Valor SEMPRE em 'aaaa-mm-dd'; o trigger mostra 'dd/mm/aaaa'. Dias
 * desactivados ficam cinzentos e não são clicáveis. Se `value` aponta para um
 * dia desactivado (ex.: sessão guardada ao sábado com a regra desligada), o
 * campo MOSTRA-o na mesma — a validação existente é que explica o erro; nunca
 * se apaga nem se altera o valor em silêncio.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  isDayDisabled,
  disabled,
  invalid,
  placeholder = 'dd/mm/aaaa',
  id,
  required,
  className,
  'aria-label': ariaLabel,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? deISO(value) : undefined;

  const isDisabled = (dia: Date): boolean => {
    const iso = paraISO(dia);
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    if (isDayDisabled?.(dia)) return true;
    return false;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          className={cn(
            'w-full justify-start gap-2 text-left font-normal',
            !value && 'text-muted-foreground',
            invalid && 'border-destructive focus-visible:ring-destructive/30',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
          {value ? fmtBR(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-auto max-w-[calc(100vw-1rem)] p-0"
      >
        <Calendar
          mode="single"
          locale={ptBR}
          weekStartsOn={1}
          selected={selected}
          onSelect={(dia) => {
            if (dia) {
              onChange(paraISO(dia));
              setOpen(false);
            }
          }}
          disabled={isDisabled}
          formatters={{
            // O `formatters.formatDay` do react-day-picker v8 define TODO o
            // conteúdo do botão do dia (substitui, não acrescenta). Devolve-se
            // o número visível + um nome acessível `sr-only` em pt-BR, para que
            // o leitor de ecrã leia «19, domingo, 19 de outubro de 2026» sem
            // apagar o número do dia.
            formatDay: (dia) => (
              <>
                {dia.getDate()}
                <span className="sr-only">
                  {format(dia, "EEEE, d 'de' LLLL 'de' yyyy", { locale: ptBR })}
                </span>
              </>
            ),
          }}
          className="border-0"
        />
      </PopoverContent>
    </Popover>
  );
}
