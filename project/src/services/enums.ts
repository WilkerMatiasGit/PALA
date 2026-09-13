export type UtilizadorTipo =
  | 'admin'
  | 'professor'
  | 'tecnico'
  | 'coordenador_dlab'
  | 'supervisor'
  | 'chefe_departamento';

export type LaboratorioTipo = 'quimica' | 'fisica' | 'outro';

export type DepartamentoTipo = 'DET' | 'DCSA' | 'GEO' | 'outro';

export type ActividadeTipo = 'aula' | 'visita' | 'projecto' | 'estagio';

export type ActividadeEstado =
  | 'pendente'
  | 'revisado_dlab'
  | 'revisado_supervisor'
  | 'rejeitado';

export type AgendamentoEstado =
  | 'nao_revisto'
  | 'pendente'
  | 'aprovado_dlab'
  | 'aprovado_supervisor'
  | 'rejeitado';

export type AprovacaoEtapa = 'dlab' | 'supervisor';

export type AprovacaoDecisao = 'aprovado' | 'rejeitado';

export type MaterialCategoria =
  | 'equipamento'
  | 'composto'
  | 'vidraria'
  | 'consumivel';

export type MaterialEstado =
  | 'disponivel'
  | 'em_uso'
  | 'manutencao'
  | 'esgotado';

export type MovimentacaoMotivo =
  | 'consumo_actividade'
  | 'quebra_acidente'
  | 'compra_stock'
  | 'ajuste_inventario'
  | 'outro';

export type TecnicoTipo = 'validador' | 'assistente';

export const UTILIZADOR_TIPO_LABELS: Record<UtilizadorTipo, string> = {
  admin: 'Administrador',
  professor: 'Professor',
  tecnico: 'Técnico',
  coordenador_dlab: 'Coordenador DLab',
  supervisor: 'Supervisor',
  chefe_departamento: 'Chefe de Departamento',
};

export const UTILIZADOR_TIPO_SHORT: Record<UtilizadorTipo, string> = {
  admin: 'Admin',
  professor: 'Prof.',
  tecnico: 'Técn.',
  coordenador_dlab: 'CDLab',
  supervisor: 'Sup.',
  chefe_departamento: 'CDpto',
};

export const LABORATORIO_TIPO_LABELS: Record<LaboratorioTipo, string> = {
  quimica: 'Química',
  fisica: 'Física',
  outro: 'Outro',
};

export const DEPARTAMENTO_LABELS: Record<DepartamentoTipo, string> = {
  DET: 'DET',
  DCSA: 'DCSA',
  GEO: 'GEO',
  outro: 'Outro',
};

export const ACTIVIDADE_TIPO_LABELS: Record<ActividadeTipo, string> = {
  aula: 'Aula',
  visita: 'Visita',
  projecto: 'Projeto',
  estagio: 'Estágio',
};

export const ACTIVIDADE_ESTADO_LABELS: Record<ActividadeEstado, string> = {
  pendente: 'Pendente',
  revisado_dlab: 'Revisto DLab',
  revisado_supervisor: 'Revisto',
  rejeitado: 'Rejeitado',
};

export const AGENDAMENTO_ESTADO_LABELS: Record<AgendamentoEstado, string> = {
  nao_revisto: 'Não revisto',
  pendente: 'Pendente',
  aprovado_dlab: 'Aprovado DLab',
  aprovado_supervisor: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export const APROVACAO_ETAPA_LABELS: Record<AprovacaoEtapa, string> = {
  dlab: 'DLab',
  supervisor: 'Supervisor',
};

export const APROVACAO_DECISAO_LABELS: Record<AprovacaoDecisao, string> = {
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export const MATERIAL_CATEGORIA_LABELS: Record<MaterialCategoria, string> = {
  equipamento: 'Equipamento',
  composto: 'Composto',
  vidraria: 'Vidraria',
  consumivel: 'Consumível',
};

export const MATERIAL_ESTADO_LABELS: Record<MaterialEstado, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em Uso',
  manutencao: 'Manutenção',
  esgotado: 'Esgotado',
};

export const MOVIMENTACAO_MOTIVO_LABELS: Record<MovimentacaoMotivo, string> = {
  consumo_actividade: 'Consumo de Atividade',
  quebra_acidente: 'Quebra/Acidente',
  compra_stock: 'Compra de Stock',
  ajuste_inventario: 'Ajuste de Inventário',
  outro: 'Outro',
};

export const TECNICO_TIPO_LABELS: Record<TecnicoTipo, string> = {
  validador: 'Validador',
  assistente: 'Assistente',
};

export const UTILIZADOR_TIPO_OPTIONS = Object.entries(
  UTILIZADOR_TIPO_LABELS
).map(([value, label]) => ({ value, label }));

export const LABORATORIO_TIPO_OPTIONS = Object.entries(
  LABORATORIO_TIPO_LABELS
).map(([value, label]) => ({ value, label }));

export const DEPARTAMENTO_OPTIONS = Object.entries(DEPARTAMENTO_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const ACTIVIDADE_TIPO_OPTIONS = Object.entries(
  ACTIVIDADE_TIPO_LABELS
).map(([value, label]) => ({ value, label }));

export const MATERIAL_CATEGORIA_OPTIONS = Object.entries(
  MATERIAL_CATEGORIA_LABELS
).map(([value, label]) => ({ value, label }));

export const MATERIAL_ESTADO_OPTIONS = Object.entries(
  MATERIAL_ESTADO_LABELS
).map(([value, label]) => ({ value, label }));

export const MOVIMENTACAO_MOTIVO_OPTIONS = Object.entries(
  MOVIMENTACAO_MOTIVO_LABELS
).map(([value, label]) => ({ value, label }));
