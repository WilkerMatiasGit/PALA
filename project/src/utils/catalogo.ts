// Título amigável para valores de catálogo (ex.: "unidade_laboratorial" → "Unidade laboratorial").
export function catalogoLabel(nome: string): string {
  if (!nome) return '';
  return nome
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}