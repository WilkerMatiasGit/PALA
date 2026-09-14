export const PAGE_SIZE = 10;

export const APP_NAME = 'DLab';
export const APP_FULL_NAME = 'Gestão de Laboratórios';

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MESES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Semestre 1-based (1=Ano1Sem1, 2=Ano1Sem2, 3=Ano2Sem1, …) → Ano lectivo (1-based). */
export const semestreToAno = (sem: number): number => Math.ceil(sem / 2);

/** Semestre 1-based → ordinal dentro do ano (1 ou 2). */
export const semestreNoAno = (sem: number): number => ((sem - 1) % 2) + 1;

/** Ano lectivo (1-based) + semestreNoAno (1|2) → semestre 1-based. */
export const anoSemestreToSemestre = (ano: number, semNoAno: number): number =>
  (ano - 1) * 2 + semNoAno;
