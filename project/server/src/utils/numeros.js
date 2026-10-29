// Conversão estrita de inteiros opcionais recebidos por JSON.
//
// Distingue três estados:
//   • `undefined` → o campo não foi indicado (vazio, null ou ausente);
//   • `null`      → foi indicado mas é inválido (booleano, array, decimal,
//                   fora do intervalo de Int32, etc.);
//   • número      → inteiro válido dentro do intervalo.
//
// Evita as coerções silenciosas de `Number(...)` (ex.: `true` → 1,
// `[2]` → 2, `""` → 0) que escondiam valores inválidos.
export function inteiroOpcional(valor, { min = 1, max = 2147483647 } = {}) {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (s === '') return undefined;
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }
  if (typeof valor !== 'number') return null;
  return Number.isInteger(valor) && valor >= min && valor <= max ? valor : null;
}
