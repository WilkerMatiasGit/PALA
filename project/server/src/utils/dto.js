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

export function toLabGet(l) {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
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

// Recebe Material com include { laboratorio }
export function toMaterialGet(m) {
  return {
    id: m.id,
    laboratorio_id: m.laboratorio_id,
    laboratorio_nome: m.laboratorio?.nome ?? '',
    nome: m.nome,
    categoria: m.categoria,
    quantidade: m.quantidade,
    quantidade_minima: m.quantidade_minima,
    unidade: m.unidade,
    estado: m.estado,
    criado_em: m.criado_em,
    actualizado_em: m.actualizado_em,
  };
}

// Recebe HistoricoMaterial com include { material, utilizador, actividade }
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
  if (h.actividade_id != null) {
    out.actividade_id = h.actividade_id;
    out.actividade_nome = h.actividade?.nome;
  }
  return out;
}

// Recebe Actividade com include { utilizador, laboratorio }
export function toActividadeGet(a) {
  return {
    id: a.id,
    nome: a.nome,
    utilizador_id: a.utilizador_id,
    utilizador_nome: a.utilizador?.nome ?? '',
    laboratorio_id: a.laboratorio_id,
    laboratorio_nome: a.laboratorio?.nome ?? '',
    tipo: a.tipo,
    estado: a.estado,
    num_participantes: a.num_participantes,
    precisa_assistente: a.precisa_assistente,
    observacoes: a.observacoes ?? '',
    criado_em: a.criado_em,
    actualizado_em: a.actualizado_em,
  };
}

// Recebe Aula com include { curso_disciplina: { curso, disciplina } }
export function toAulaGet(aula) {
  const cd = aula.curso_disciplina;
  return {
    id: aula.id,
    actividade_id: aula.actividade_id,
    curso_disciplina_id: aula.curso_disciplina_id,
    curso_disciplina_nome: cd
      ? `${cd.disciplina?.nome ?? ''} (${cd.curso?.nome ?? ''} - ${cd.semestre}º Sem)`
      : '',
    tema: aula.tema ?? '',
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

// Recebe Projecto com include { responsavel }
export function toProjectoGet(p) {
  return {
    id: p.id,
    actividade_id: p.actividade_id,
    responsavel_id: p.responsavel_id,
    responsavel_nome: p.responsavel?.nome ?? '',
    titulo: p.titulo,
    descricao: p.descricao ?? '',
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    ...(p.anexo_path ? { anexo_path: p.anexo_path } : {}),
    criado_em: p.criado_em,
    actualizado_em: p.actualizado_em,
  };
}

// Recebe Estagio com include { responsavel, estudante }
export function toEstagioGet(e) {
  return {
    id: e.id,
    actividade_id: e.actividade_id,
    responsavel_id: e.responsavel_id,
    responsavel_nome: e.responsavel?.nome ?? '',
    estudante_id: e.estudante_id,
    estudante_nome: e.estudante?.nome ?? '',
    data_inicio: e.data_inicio,
    data_fim: e.data_fim,
    ...(e.anexo_path ? { anexo_path: e.anexo_path } : {}),
    criado_em: e.criado_em,
    actualizado_em: e.actualizado_em,
  };
}

// Recebe Agendamento com include { actividad: { laboratorio, utilizador } }
export function toAgendamentoGet(g) {
  const act = g.actividade;
  return {
    id: g.id,
    actividade_id: g.actividade_id,
    actividade_nome: act?.nome ?? '',
    laboratorio_id: act?.laboratorio_id,
    laboratorio_nome: act?.laboratorio?.nome ?? '',
    hora_inicio: g.hora_inicio,
    hora_fim: g.hora_fim,
    confirmado_professor_em: g.confirmado_professor_em,
    confirmado_tecnico_em: g.confirmado_tecnico_em,
    realizado: g.realizado,
    criado_em: g.criado_em,
    actualizado_em: g.actualizado_em,
  };
}

// Recebe ActividadeTecnico com include { utilizador, atividade }
export function toActividadeTecnicoGet(t) {
  return {
    id: t.id,
    actividade_id: t.actividade_id,
    ...(t.actividade ? { actividade_nome: t.actividade.nome } : {}),
    utilizador_id: t.utilizador_id,
    utilizador_nome: t.utilizador?.nome ?? '',
    papel: t.papel,
    criado_em: t.criado_em,
    actualizado_em: t.actualizado_em,
  };
}

// Recebe ActividadeMaterial com include { material, atividade }
export function toActividadeMaterialGet(am) {
  return {
    id: am.id,
    actividade_id: am.actividade_id,
    material_id: am.material_id,
    material_nome: am.material?.nome ?? '',
    quantidade_estimada: am.quantidade_estimada,
    criado_em: am.criado_em,
    actualizado_em: am.actualizado_em,
  };
}

// Recebe Aprovacao com include { aprovador, atividade }
export function toAprovacaoGet(ap) {
  return {
    id: ap.id,
    actividade_id: ap.actividade_id,
    ...(ap.actividade ? { actividade_nome: ap.actividade.nome } : {}),
    aprovador_id: ap.aprovador_id,
    aprovador_nome: ap.aprovador?.nome ?? '',
    etapa: ap.etapa,
    decisao: ap.decisao,
    comentario: ap.comentario ?? '',
    decidido_em: ap.decidido_em ?? '',
    criado_em: ap.criado_em,
    actualizado_em: ap.actualizado_em,
  };
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