export interface RelatorioDadosJson {
  total_actividades: number;
  total_realizadas: number;
  total_materiais_baixados: number;
  por_tipo: { tipo: string; count: number }[];
  por_lab: { lab: string; count: number }[];
}

export interface RelatorioGet {
  id: number;
  laboratorio_id: number;
  laboratorio_nome: string;
  criado_por: number;
  criado_por_nome: string;
  mes: number;
  ano: number;
  dados_json: string;
  criado_em: string;
  actualizado_em: string;
}

export interface RelatorioCreate {
  laboratorio_id: number;
  mes: number;
  ano: number;
}
