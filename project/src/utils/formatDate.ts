import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateStr: string | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), fmt, { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'HH:mm', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ptBR });
  } catch {
    return '—';
  }
}

export function monthLabel(month: number, year: number): string {
  const names = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  return `${names[month - 1] ?? ''} ${year}`;
}
