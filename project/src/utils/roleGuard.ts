import type { UtilizadorTipo } from '@/services/enums';

export type Role = UtilizadorTipo;

export function hasRole(userTipo: UtilizadorTipo | undefined, allowed: UtilizadorTipo[]): boolean {
  if (!userTipo) return false;
  return allowed.includes(userTipo);
}

export function canAccess(userTipo: UtilizadorTipo | undefined, allowed: UtilizadorTipo[]): boolean {
  return hasRole(userTipo, allowed);
}

export const ALL_ROLES: UtilizadorTipo[] = [
  'admin',
  'professor',
  'tecnico',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const ADMIN_ONLY: UtilizadorTipo[] = ['admin'];

export const CAN_CRUD_ACTIVIDADES: UtilizadorTipo[] = [
  'admin',
  'professor',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const CAN_CRUD_ESTUDANTES: UtilizadorTipo[] = [
  'admin',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const CAN_READ_MATERIAIS: UtilizadorTipo[] = [
  'admin',
  'tecnico',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const CAN_READ_LAB_DETALHE: UtilizadorTipo[] = [
  'admin',
  'tecnico',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const CAN_CRUD_MATERIAIS: UtilizadorTipo[] = [
  'admin',
  'tecnico',
  'coordenador_dlab',
  'supervisor',
  'chefe_departamento',
];

export const CAN_CRUD_HISTORICO: UtilizadorTipo[] = [
  'admin',
  'tecnico',
  'supervisor',
  'chefe_departamento',
];

export const CAN_CRUD_RELATORIOS: UtilizadorTipo[] = ['admin', 'tecnico'];

export const CAN_APPROVE: UtilizadorTipo[] = [
  'admin',
  'coordenador_dlab',
  'supervisor',
];

export const SIDEBAR_SECTIONS: {
  label: string;
  items: {
    label: string;
    path: string;
    icon: string;
    roles: UtilizadorTipo[];
  }[];
}[] = [
  {
    label: 'Geral',
    items: [
      { label: 'Início', path: '/inicio', icon: 'LayoutDashboard', roles: ALL_ROLES },
      { label: 'Actividades', path: '/actividades', icon: 'ClipboardList', roles: ALL_ROLES },
      { label: 'Aprovações', path: '/aprovacoes', icon: 'CheckCircle', roles: ['admin', 'coordenador_dlab', 'supervisor', 'chefe_departamento'] },
      { label: 'Calendário', path: '/calendario', icon: 'Calendar', roles: ALL_ROLES },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { label: 'Materiais', path: '/materiais', icon: 'Package', roles: CAN_READ_MATERIAIS },
      { label: 'Histórico', path: '/materiais/historico', icon: 'History', roles: ['admin', 'tecnico', 'supervisor', 'chefe_departamento'] },
      { label: 'Relatórios', path: '/relatorios', icon: 'BarChart3', roles: ['admin', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento'] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Laboratórios', path: '/labs', icon: 'FlaskConical', roles: ALL_ROLES },
      { label: 'Cursos', path: '/cursos', icon: 'GraduationCap', roles: ALL_ROLES },
      { label: 'Disciplinas', path: '/disciplinas', icon: 'BookOpen', roles: ALL_ROLES },
      { label: 'Estudantes', path: '/estudantes', icon: 'Users', roles: ALL_ROLES },
      { label: 'Utilizadores', path: '/users', icon: 'UserCog', roles: ['admin'] },
    ],
  },
];
