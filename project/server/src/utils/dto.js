// Mappers Prisma → DTOs (shape idêntico ao que o front espera — contrato 4.4).
// Reconstroem os nomes denormalizados a partir das relações.

export function toUserGet(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    tipo: u.tipo,
    criado_em: u.criado_em,
    actualizado_em: u.actualizado_em,
  };
}

// Recebe Laboratorio com include { unidadeLaboratorial } — tipo = chave do catálogo
export function toLabGet(l) {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.unidadeLaboratorial?.nome ?? 'outro',
    capacidade: l.capacidade,
    descricao: l.descricao ?? '',
    criado_em: l.criado_em,
    actualizado_em: l.actualizado_em,
  };
}

export function toCursoGet(c) {
  return {
    id: c.id,
    departamento: c.departamento,
    nome: c.nome,
    abreviacao: c.abreviacao,
    criado_em: c.criado_em,
    actualizado_em: c.actualizado_em,
  };
}

export function toLimiteGet(l) {
  return {
    id: l.id,
    tipo: l.tipo,
    min: l.min,
    max: l.max,
    limite_activo: l.limite_activo,
  };
}

export function toConfiguracaoGeralGet(c) {
  return {
    permitir_fim_semana: Boolean(c?.permitir_fim_semana),
    permitir_feriados: Boolean(c?.permitir_feriados),
  };
}

export function toFeriadoGet(r) {
  if (!r) return null;
  let data = r.data;
  if (data instanceof Date) {
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, '0');
    const d = String(data.getDate()).padStart(2, '0');
    data = `${y}-${m}-${d}`;
  } else if (typeof data === 'string') {
    data = data.slice(0, 10);
  }
  return {
    id: r.id,
    nome: r.nome,
    data,
    tipo: r.tipo,
    activo: r.activo !== false,
    criado_em: r.criado_em,
    actualizado_em: r.actualizado_em,
  };
}

export function toDisciplinaGet(d) {
  return {
    id: d.id,
    nome: d.nome,
    criado_em: d.criado_em,
    actualizado_em: d.actualizado_em,
  };
}

// Recebe CursoDisciplina com include { curso, disciplina }
export function toCursoDisciplinaGet(cd) {
  return {
    id: cd.id,
    curso_id: cd.curso_id,
    curso_nome: cd.curso?.nome ?? '',
    curso_abreviacao: cd.curso?.abreviacao ?? '',
    disciplina_id: cd.disciplina_id,
    disciplina_nome: cd.disciplina?.nome ?? '',
    semestre: cd.semestre,
    criado_em: cd.criado_em,
    actualizado_em: cd.actualizado_em,
  };
}

// Recebe Estudante com include { curso }
export function toEstudanteGet(e) {
  return {
    id: e.id,
    nome: e.nome,
    curso_id: e.curso_id,
    curso_nome: e.curso?.nome ?? '',
    criado_em: e.criado_em,
    actualizado_em: e.actualizado_em,
  };
}

// Recebe Material com include { laboratorio, categoria, unidade }
export function toMaterialGet(m) {
  return {
    id: m.id,
    laboratorio_id: m.laboratorio_id,
    laboratorio_nome: m.laboratorio?.nome ?? '',
    nome: m.nome,
    categoria: m.categoria?.nome ?? '',
    quantidade: m.quantidade,
    quantidade_minima: m.quantidade_minima,
    unidade: m.unidade?.nome ?? 'un',
    estado: m.estado,
    criado_em: m.criado_em,
    actualizado_em: m.actualizado_em,
  };
}

// Recebe HistoricoMaterial com include { material, utilizador, agendamento: { actividade } }
export function toHistoricoGet(h) {
  const out = {
    id: h.id,
    material_id: h.material_id,
    material_nome: h.material?.nome ?? '',
    utilizador_id: h.utilizador_id,
    utilizador_nome: h.utilizador?.nome ?? '',
    quantidade_movimentada: h.quantidade_movimentada,
    motivo: h.motivo,
    descricao: h.descricao,
    criado_em: h.criado_em,
    actualizado_em: h.actualizado_em,
  };
  if (h.agendamento_id != null) {
    out.agendamento_id = h.agendamento_id;
    out.agendamento_nome = h.agendamento?.actividade?.nome;
  }
  return out;
}

// Recebe Actividade com include { criado_por, responsavel, laboratorio }
export function toActividadeGet(a, flags) {
  return {
    id: a.id,
    nome: a.nome,
    criado_por_id: a.criado_por_id,
    criado_por_nome: a.criado_por?.nome ?? '',
    responsavel_id: a.responsavel_id,
    responsavel_nome: a.responsavel?.nome ?? '',
    laboratorio_id: a.laboratorio_id,
    laboratorio_nome: a.laboratorio?.nome ?? '',
    tipo: a.tipo,
    estado: a.estado,
    observacoes: a.observacoes ?? '',
    criado_em: a.criado_em,
    actualizado_em: a.actualizado_em,
    ...(flags || {}),
  };
}

// Recebe Aula com include { curso_disciplina: { curso, disciplina } }
export function toAulaGet(aula) {
  const cd = aula.curso_disciplina;
  const abreviacao = cd?.curso?.abreviacao ?? '';
  // `numero_turma` é opcional; só entra na turma derivada quando é um inteiro
  // positivo (dados legados com 0/negativo não devem gerar "_M0"/"_M-1").
  const turma = aula.turno && Number.isInteger(aula.numero_turma) && aula.numero_turma > 0
    ? `${abreviacao}_${aula.turno === 'manha' ? 'M' : 'T'}${aula.numero_turma}`
    : '';
  return {
    id: aula.id,
    actividade_id: aula.actividade_id,
    curso_disciplina_id: aula.curso_disciplina_id,
    curso_disciplina_nome: cd
      ? `${cd.disciplina?.nome ?? ''} (${cd.curso?.nome ?? ''} - ${cd.semestre}º Sem)`
      : '',
    tema: aula.tema ?? '',
    turno: aula.turno,
    numero_turma: aula.numero_turma,
    turma,
    criado_em: aula.criado_em,
    actualizado_em: aula.actualizado_em,
  };
}

// Recebe Visita (pode incluir { actividad } para devolver nome)
export function toVisitaGet(v) {
  return {
    id: v.id,
    actividade_id: v.actividade_id,
    ...(v.actividade ? { actividade_nome: v.actividade.nome } : {}),
    nome_visitante: v.nome_visitante,
    ...(v.instituicao ? { instituicao: v.instituicao } : {}),
    telefone: v.telefone,
    email: v.email,
    criado_em: v.criado_em,
    actualizado_em: v.actualizado_em,
  };
}

// Recebe Projecto
export function toProjectoGet(p) {
  return {
    id: p.id,
    actividade_id: p.actividade_id,
    titulo: p.titulo,
    descricao: p.descricao ?? '',
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    ...(p.anexo_path ? { anexo_path: p.anexo_path } : {}),
    criado_em: p.criado_em,
    actualizado_em: p.actualizado_em,
  };
}

// Recebe Estagio com include { estudante }
export function toEstagioGet(e) {
  return {
    id: e.id,
    actividade_id: e.actividade_id,
    estudante_id: e.estudante_id,
    estudante_nome: e.estudante?.nome ?? '',
    data_inicio: e.data_inicio,
    data_fim: e.data_fim,
    ...(e.anexo_path ? { anexo_path: e.anexo_path } : {}),
    criado_em: e.criado_em,
    actualizado_em: e.actualizado_em,
  };
}

// Recebe Agendamento com include { actividad: { laboratorio, utilizador } } e,
// opcionalmente, tecnicos: { utilizador } (atribuição por sessão).
export function toAgendamentoGet(g) {
  const act = g.actividade;
  const val = g.tecnicos?.find((t) => t.papel === 'validador' && t.activo);
  const ass = g.tecnicos?.find((t) => t.papel === 'assistente' && t.activo);
  return {
    id: g.id,
    actividade_id: g.actividade_id,
    actividade_nome: act?.nome ?? '',
    laboratorio_id: act?.laboratorio_id,
    laboratorio_nome: act?.laboratorio?.nome ?? '',
    num_participantes: g.num_participantes,
    hora_inicio: g.hora_inicio,
    hora_fim: g.hora_fim,
    confirmado_professor_em: g.confirmado_professor_em,
    confirmado_tecnico_em: g.confirmado_tecnico_em,
    realizado: g.realizado,
    estado: g.estado,
    validador_id: val?.utilizador_id ?? null,
    validador_nome: val?.utilizador?.nome ?? '',
    assistente_id: ass?.utilizador_id ?? null,
    assistente_nome: ass?.utilizador?.nome ?? '',
    criado_em: g.criado_em,
    actualizado_em: g.actualizado_em,
  };
}

// Recebe AgendamentoTecnico com include { utilizador, agendamento }
export function toAgendamentoTecnicoGet(t) {
  return {
    id: t.id,
    agendamento_id: t.agendamento_id,
    ...(t.agendamento ? { agendamento_nome: t.agendamento.actividade?.nome } : {}),
    utilizador_id: t.utilizador_id,
    utilizador_nome: t.utilizador?.nome ?? '',
    papel: t.papel,
    criado_em: t.criado_em,
    actualizado_em: t.actualizado_em,
  };
}

// Recebe AgendamentoMaterial com include { material, agendamento }
export function toAgendamentoMaterialGet(am) {
  return {
    id: am.id,
    agendamento_id: am.agendamento_id,
    material_id: am.material_id,
    quantidade_estimada: am.quantidade_estimada,
    criado_em: am.criado_em,
    actualizado_em: am.actualizado_em,
    activo: am.activo,
    material_nome: am.material?.nome ?? '',
  };
}

// Recebe Estagio com include { actividade: { laboratorio, responsavel } }
// — usado em GET /estudantes/:id/actividades (vínculos de actividades de um estudante).
export function toEstagioActividadeGet(est) {
  const a = est.actividade;
  return {
    estagio_id: est.id,
    ...(a ? {
      actividade_id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      estado: a.estado,
      laboratorio_id: a.laboratorio_id,
      laboratorio_nome: a.laboratorio?.nome ?? '',
      responsavel_id: a.responsavel_id,
      responsavel_nome: a.responsavel?.nome ?? '',
      criado_em: a.criado_em,
      actualizado_em: a.actualizado_em,
    } : {}),
    data_inicio: est.data_inicio,
    data_fim: est.data_fim,
  };
}

// Recebe DecisaoAgendamento com include { decisor } (agendamento opcional)
export function toDecisaoGet(d) {
  const out = {
    id: d.id,
    agendamento_id: d.agendamento_id,
    decisor_id: d.decisor_id,
    decisor_nome: d.decisor?.nome ?? '',
    etapa: d.etapa,
    decisao: d.decisao,
    comentario: d.comentario ?? '',
    criado_em: d.criado_em,
  };
  if (d.agendamento) {
    out.agendamento_nome = d.agendamento.actividade?.nome;
    out.h_inicio = d.agendamento.hora_inicio;
    out.h_fim = d.agendamento.hora_fim;
  }
  return out;
}

// Recebe Relatorio com include { laboratorio, criadoPor }
export function toRelatorioGet(r) {
  return {
    id: r.id,
    laboratorio_id: r.laboratorio_id,
    laboratorio_nome: r.laboratorio?.nome ?? '',
    criado_por: r.criado_por,
    criado_por_nome: r.criadoPor?.nome ?? '',
    mes: r.mes,
    ano: r.ano,
    dados_json: r.dados_json,
    criado_em: r.criado_em,
    actualizado_em: r.actualizado_em,
  };
}