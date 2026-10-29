// ---------------------------------------------------------------------------
// Camada de datas do formulário de actividades: conversões e regras de dias.
//
// Regras de ouro (bug histórico de fuso horário — nunca quebrar):
//  • Date -> 'aaaa-mm-dd' SEMPRE pelos componentes LOCAIS (`paraISO`).
//  • 'aaaa-mm-dd' -> Date SEMPRE como meia-noite LOCAL (`deISO`).
//  • NUNCA usar `toISOString()` nem `new Date('aaaa-mm-dd')`: ambos interpretam
//    em UTC e deslocam o dia perto da meia-noite (ex.: meia-noite local de
//    24/10 em Africa/Luanda (UTC+1) é 23:00Z de 23/10 — o dia errado).
// ---------------------------------------------------------------------------

/** 'aaaa-mm-dd' -> Date (meia-noite LOCAL). */
export const deISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Date -> 'aaaa-mm-dd' (dia de calendário LOCAL). */
export const paraISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Hoje (dia de calendário local) em 'aaaa-mm-dd'. */
export const hojeISO = (): string => paraISO(new Date());

/** 'aaaa-mm-dd' -> 'dd/mm/aaaa' (mensagens de validação e trigger do campo). */
export const fmtBR = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// Converte uma data/hora ISO vinda do backend (ex.: "2026-08-15T00:00:00.000Z")
// para o dia de calendário 'aaaa-mm-dd' SEM deslocação de fuso: corta a string
// (o backend envia o dia escrito) e, se receber um Date, usa `paraISO` (local).
export const toDateInput = (v: string | Date | null | undefined): string => {
  if (!v) return '';
  return typeof v === 'string' ? v.slice(0, 10) : paraISO(v);
};

export const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

/** Dia da semana (0=domingo … 6=sábado) do dia de calendário 'aaaa-mm-dd'. */
export const diaSemana = (iso: string): number => deISO(iso).getDay();

export const ehFimDeSemana = (iso: string): boolean => {
  const dow = diaSemana(iso);
  return dow === 0 || dow === 6;
};

/**
 * Regras de desactivação de dias do `ui/date-field.tsx`.
 *
 * `diaDesactivado` é o ÚNICO ponto de decisão partilhado: o componente só
 * desenha os dias que esta função bloqueia. Acrescentar regras novas
 * (feriados nacionais, antecedência mínima, bloqueios pontuais de
 * laboratório, …) faz-se AQUI, sem tocar no componente.
 */
export interface RegrasDia {
  /** 'hoje' do dia de calendário local. Por defeito: `hojeISO()`. */
  hoje?: string;
  /** Limite inferior inclusivo (ex.: data_inicio ou início do período). */
  min?: string;
  /** Limite superior inclusivo (ex.: data_fim ou fim do período). */
  max?: string;
  /** Aplica a regra de fim de semana a este campo (só o dia das sessões). */
  fimDeSemana?: boolean;
  /** Valor de `configuracoes_gerais.permitir_fim_semana` (null = sem regra). */
  permitirFimSemana?: boolean | null;
  /** Aplica a regra de feriados a este campo (só o dia das sessões). */
  feriados?: boolean;
  /** Lista de feriados activos (`data` 'aaaa-mm-dd', `tipo`). */
  feriadosLista?: Array<{ data: string; nome?: string; tipo?: string }>;
  /** Valor de `configuracoes_gerais.permitir_feriados` (null = sem regra). */
  permitirFeriados?: boolean | null;
}

/**
 * Um feriado cobre um dia? `tipo = 'feriado'` repete-se todos os anos (mesmo
 * dia/mês); os restantes tipos são datas únicas. Espelha `feriadoCobre` do
 * backend (`server/src/utils/validarSessao.js`).
 */
export const feriadoCobre = (
  feriado: { data: string; tipo?: string } | undefined,
  iso: string
): boolean => {
  if (!feriado || !feriado.data) return false;
  const data = toDateInput(feriado.data);
  if (!data) return false;
  if (feriado.tipo === 'feriado') {
    const [, fm, fd] = data.split('-');
    const [, m, d] = iso.split('-');
    return fm === m && fd === d;
  }
  return data === iso;
};

/** true => o dia 'aaaa-mm-dd' cai num feriado activo da lista. */
export const ehFeriado = (
  iso: string,
  feriados: Array<{ data: string; nome?: string; tipo?: string }> = []
): boolean => feriados.some((f) => feriadoCobre(f, iso));

/** true => o dia está desactivado (não clicável) no calendário. */
export const diaDesactivado = (date: Date, regras: RegrasDia = {}): boolean => {
  const iso = paraISO(date);
  // (1) dias de calendário passados — nunca agendáveis
  if (iso < (regras.hoje ?? hojeISO())) return true;
  // (2) fora dos limites inclusivos (min/max do campo; em projeto/estágio,
  //     o período [data_inicio, data_fim] da especialização)
  if (regras.min && iso < regras.min) return true;
  if (regras.max && iso > regras.max) return true;
  // (3) fim de semana quando a regra está desligada (aplica-se ao DIA DA SESSÃO;
  //     a data de início/fim do projecto/estágio PODE cair a sábado ou domingo)
  if (regras.fimDeSemana && regras.permitirFimSemana === false && ehFimDeSemana(iso)) {
    return true;
  }
  // (4) feriado quando a regra está desligada (só o DIA DA SESSÃO, como o fim de
  //     semana; o fim de semana tem precedência na mensagem do backend)
  if (
    regras.feriados &&
    regras.permitirFeriados === false &&
    regras.feriadosLista &&
    regras.feriadosLista.length > 0 &&
    ehFeriado(iso, regras.feriadosLista)
  ) {
    return true;
  }
  // PONTO DE EXTENSÃO — acrescentar aqui novas regras de desactivação.
  return false;
};
