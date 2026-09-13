import type {
  ActividadeEstado,
  ActividadeTipo,
  AgendamentoEstado,
  AprovacaoDecisao,
  AprovacaoEtapa,
  MaterialEstado,
  MovimentacaoMotivo,
  TecnicoTipo,
} from '@/services/enums';
import {
  ACTIVIDADE_ESTADO_LABELS,
  ACTIVIDADE_TIPO_LABELS,
  AGENDAMENTO_ESTADO_LABELS,
  APROVACAO_DECISAO_LABELS,
  APROVACAO_ETAPA_LABELS,
  MATERIAL_ESTADO_LABELS,
  MOVIMENTACAO_MOTIVO_LABELS,
  TECNICO_TIPO_LABELS,
} from '@/services/enums';

interface EstadoConfig {
  label: string;
  className: string;
}

export function formatEstado(estado: ActividadeEstado): EstadoConfig {
  const configs: Record<ActividadeEstado, EstadoConfig> = {
    pendente: {
      label: ACTIVIDADE_ESTADO_LABELS[estado],
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    revisado_dlab: {
      label: ACTIVIDADE_ESTADO_LABELS[estado],
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    revisado_supervisor: {
      label: ACTIVIDADE_ESTADO_LABELS[estado],
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    rejeitado: {
      label: ACTIVIDADE_ESTADO_LABELS[estado],
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  };
  return configs[estado];
}

export function formatAgendamentoEstado(estado: AgendamentoEstado): EstadoConfig {
  const configs: Record<AgendamentoEstado, EstadoConfig> = {
    nao_revisto: {
      label: AGENDAMENTO_ESTADO_LABELS[estado],
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    pendente: {
      label: AGENDAMENTO_ESTADO_LABELS[estado],
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    aprovado_dlab: {
      label: AGENDAMENTO_ESTADO_LABELS[estado],
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    aprovado_supervisor: {
      label: AGENDAMENTO_ESTADO_LABELS[estado],
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    rejeitado: {
      label: AGENDAMENTO_ESTADO_LABELS[estado],
      className: 'bg-red-100 text-red-800 border-red-200',
    },
  };
  return configs[estado];
}

export function formatTipo(tipo: ActividadeTipo): EstadoConfig {
  const configs: Record<ActividadeTipo, EstadoConfig> = {
    aula: { label: ACTIVIDADE_TIPO_LABELS.aula, className: 'bg-sky-100 text-sky-800 border-sky-200' },
    visita: { label: ACTIVIDADE_TIPO_LABELS.visita, className: 'bg-violet-100 text-violet-800 border-violet-200' },
    projecto: { label: ACTIVIDADE_TIPO_LABELS.projecto, className: 'bg-teal-100 text-teal-800 border-teal-200' },
    estagio: { label: ACTIVIDADE_TIPO_LABELS.estagio, className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  };
  return configs[tipo];
}

export function formatMaterialEstado(estado: MaterialEstado): EstadoConfig {
  const configs: Record<MaterialEstado, EstadoConfig> = {
    disponivel: { label: MATERIAL_ESTADO_LABELS.disponivel, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    em_uso: { label: MATERIAL_ESTADO_LABELS.em_uso, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    manutencao: { label: MATERIAL_ESTADO_LABELS.manutencao, className: 'bg-amber-100 text-amber-800 border-amber-200' },
    esgotado: { label: MATERIAL_ESTADO_LABELS.esgotado, className: 'bg-red-100 text-red-800 border-red-200' },
  };
  return configs[estado];
}

export function formatMotivo(motivo: MovimentacaoMotivo): string {
  return MOVIMENTACAO_MOTIVO_LABELS[motivo];
}

export function formatDecisao(decisao: AprovacaoDecisao): EstadoConfig {
  return decisao === 'aprovado'
    ? { label: APROVACAO_DECISAO_LABELS.aprovado, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    : { label: APROVACAO_DECISAO_LABELS.rejeitado, className: 'bg-red-100 text-red-800 border-red-200' };
}

export function formatEtapa(etapa: AprovacaoEtapa): string {
  return APROVACAO_ETAPA_LABELS[etapa];
}

export function formatPapel(papel: TecnicoTipo): EstadoConfig {
  return papel === 'validador'
    ? { label: TECNICO_TIPO_LABELS.validador, className: 'bg-blue-100 text-blue-800 border-blue-200' }
    : { label: TECNICO_TIPO_LABELS.assistente, className: 'bg-violet-100 text-violet-800 border-violet-200' };
}
