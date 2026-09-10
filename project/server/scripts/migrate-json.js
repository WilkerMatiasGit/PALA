// Migração db.json → MySQL (Prisma).
// Uso: node server/scripts/migrate-json.js [--force]
//  - Pára se a base já tiver utilizadores, a menos que --force seja dado.
//  - Preserva os IDs do JSON (o MySQL ajusta o auto_increment automaticamente).
//  - Recalcula materiais.quantidade a partir do histórico (RF17).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'db.json');

const force = process.argv.includes('--force');

async function run() {
  const db = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

  const existing = await prisma.utilizador.count();
  if (existing > 0 && !force) {
    console.error(`[migracao] A base já tem ${existing} utilizadores. Usa --force para continuar assim mesmo.`);
    process.exit(1);
  }

  const toDate = (s) => (s ? new Date(s) : null);

  // ---- Utilizadores ----
  console.log('[migracao] utilizadores...');
  for (const u of db.utilizadores || []) {
    await prisma.utilizador.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        senha_hash: u.senha_hash || null,
        tipo: u.tipo,
        criado_em: toDate(u.criado_em),
        actualizado_em: toDate(u.actualizado_em),
        activo: u.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Laboratórios ----
  console.log('[migracao] laboratorios...');
  for (const l of db.laboratorios || []) {
    await prisma.laboratorio.upsert({
      where: { id: l.id },
      create: {
        id: l.id,
        nome: l.nome,
        tipo: l.tipo,
        descricao: l.descricao ?? '',
        criado_em: toDate(l.criado_em),
        actualizado_em: toDate(l.actualizado_em),
        activo: l.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Cursos / Disciplinas / Curso-Disciplinas ----
  console.log('[migracao] cursos...');
  for (const c of db.cursos || []) {
    await prisma.curso.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        departamento: c.departamento,
        nome: c.nome,
        abreviacao: c.abreviacao,
        criado_em: toDate(c.criado_em),
        actualizado_em: toDate(c.actualizado_em),
        activo: c.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] disciplinas...');
  for (const d of db.disciplinas || []) {
    await prisma.disciplina.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        nome: d.nome,
        criado_em: toDate(d.criado_em),
        actualizado_em: toDate(d.actualizado_em),
        activo: d.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] cursoDisciplinas...');
  for (const cd of db.cursoDisciplinas || []) {
    await prisma.cursoDisciplina.upsert({
      where: { id: cd.id },
      create: {
        id: cd.id,
        curso_id: cd.curso_id,
        disciplina_id: cd.disciplina_id,
        semestre: cd.semestre,
        criado_em: toDate(cd.criado_em),
        actualizado_em: toDate(cd.actualizado_em),
        activo: cd.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Estudantes ----
  console.log('[migracao] estudantes...');
  for (const e of db.estudantes || []) {
    await prisma.estudante.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        nome: e.nome,
        curso_id: e.curso_id,
        criado_em: toDate(e.criado_em),
        actualizado_em: toDate(e.actualizado_em),
        activo: e.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Materiais ----
  console.log('[migracao] materiais...');
  for (const m of db.materiais || []) {
    await prisma.material.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        laboratorio_id: m.laboratorio_id,
        nome: m.nome,
        categoria: m.categoria,
        quantidade: m.quantidade ?? 0,
        quantidade_minima: m.quantidade_minima,
        unidade: m.unidade,
        estado: m.estado,
        criado_em: toDate(m.criado_em),
        actualizado_em: toDate(m.actualizado_em),
        activo: m.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Actividades ----
  console.log('[migracao] actividades...');
  for (const a of db.actividades || []) {
    await prisma.actividade.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        nome: a.nome,
        utilizador_id: a.utilizador_id,
        laboratorio_id: a.laboratorio_id,
        tipo: a.tipo,
        estado: a.estado,
        observacoes: a.observacoes ?? '',
        num_participantes: a.num_participantes ?? 1,
        precisa_assistente: a.precisa_assistente ?? false,
        criado_em: toDate(a.criado_em),
        actualizado_em: toDate(a.actualizado_em),
        activo: a.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Especializações ----
  console.log('[migracao] aulas...');
  for (const x of db.aulas || []) {
    await prisma.aula.upsert({
      where: { id: x.id },
      create: {
        id: x.id,
        actividade_id: x.actividade_id,
        curso_disciplina_id: x.curso_disciplina_id,
        tema: x.tema ?? '',
        criado_em: toDate(x.criado_em),
        actualizado_em: toDate(x.actualizado_em),
        activo: x.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] visitas...');
  for (const x of db.visitas || []) {
    await prisma.visita.upsert({
      where: { id: x.id },
      create: {
        id: x.id,
        actividade_id: x.actividade_id,
        nome_visitante: x.nome_visitante,
        instituicao: x.instituicao ?? null,
        telefone: x.telefone ?? null,
        email: x.email ?? null,
        criado_em: toDate(x.criado_em),
        actualizado_em: toDate(x.actualizado_em),
        activo: x.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] projectos...');
  for (const x of db.projectos || []) {
    await prisma.projecto.upsert({
      where: { id: x.id },
      create: {
        id: x.id,
        actividade_id: x.actividade_id,
        responsavel_id: x.responsavel_id,
        titulo: x.titulo,
        descricao: x.descricao ?? '',
        data_inicio: toDate(x.data_inicio),
        data_fim: toDate(x.data_fim),
        anexo_path: x.anexo_path ?? null,
        criado_em: toDate(x.criado_em),
        actualizado_em: toDate(x.actualizado_em),
        activo: x.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] estagios...');
  for (const x of db.estagios || []) {
    await prisma.estagio.upsert({
      where: { id: x.id },
      create: {
        id: x.id,
        actividade_id: x.actividade_id,
        responsavel_id: x.responsavel_id,
        estudante_id: x.estudante_id,
        data_inicio: toDate(x.data_inicio),
        data_fim: toDate(x.data_fim),
        anexo_path: x.anexo_path ?? null,
        criado_em: toDate(x.criado_em),
        actualizado_em: toDate(x.actualizado_em),
        activo: x.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Histórico de materiais (depois dos materiais/actividades) ----
  console.log('[migracao] historico...');
  for (const h of db.historico || []) {
    await prisma.historicoMaterial.upsert({
      where: { id: h.id },
      create: {
        id: h.id,
        material_id: h.material_id,
        utilizador_id: h.utilizador_id,
        ...(h.actividade_id ? { actividade_id: h.actividade_id } : {}),
        quantidade_movimentada: h.quantidade_movimentada,
        motivo: h.motivo,
        descricao: h.descricao,
        criado_em: toDate(h.criado_em),
        actualizado_em: toDate(h.actualizado_em),
        activo: h.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Agendamentos ----
  console.log('[migracao] agendamentos...');
  for (const g of db.agendamentos || []) {
    await prisma.agendamento.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        actividade_id: g.actividade_id,
        hora_inicio: toDate(g.hora_inicio),
        hora_fim: toDate(g.hora_fim),
        confirmado_professor_em: toDate(g.confirmado_professor_em),
        confirmado_tecnico_em: toDate(g.confirmado_tecnico_em),
        realizado: g.realizado ?? false,
        criado_em: toDate(g.criado_em),
        actualizado_em: toDate(g.actualizado_em),
        activo: g.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Aprovações ----
  console.log('[migracao] aprovacoes...');
  for (const ap of db.aprovacoes || []) {
    await prisma.aprovacao.upsert({
      where: { id: ap.id },
      create: {
        id: ap.id,
        actividade_id: ap.actividade_id,
        aprovador_id: ap.aprovador_id,
        etapa: ap.etapa,
        decisao: ap.decisao,
        comentario: ap.comentario ?? '',
        decidido_em: toDate(ap.decidido_em),
        criado_em: toDate(ap.criado_em),
        actualizado_em: toDate(ap.actualizado_em),
        activo: ap.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Actividade-Técnicos / Actividade-Materiais ----
  console.log('[migracao] atividadeTecnicos...');
  for (const t of db.actividadeTecnicos || []) {
    await prisma.actividadeTecnico.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        actividade_id: t.actividade_id,
        utilizador_id: t.utilizador_id,
        papel: t.papel,
        criado_em: toDate(t.criado_em),
        actualizado_em: toDate(t.actualizado_em),
        activo: t.activo ?? true,
      },
      update: {},
    });
  }

  console.log('[migracao] atividadeMateriais...');
  for (const am of db.actividadeMateriais || []) {
    await prisma.actividadeMaterial.upsert({
      where: { id: am.id },
      create: {
        id: am.id,
        actividade_id: am.actividade_id,
        material_id: am.material_id,
        quantidade_estimada: am.quantidade_estimada,
        criado_em: toDate(am.criado_em),
        actualizado_em: toDate(am.actualizado_em),
        activo: am.activo ?? true,
      },
      update: {},
    });
  }

  // ---- Relatórios ----
  console.log('[migracao] relatorios...');
  for (const r of db.relatorios || []) {
    await prisma.relatorio.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        laboratorio_id: r.laboratorio_id,
        criado_por: r.criado_por,
        mes: r.mes,
        ano: r.ano,
        dados_json: r.dados_json ? String(r.dados_json) : '{}',
        criado_em: toDate(r.criado_em),
        actualizado_em: toDate(r.actualizado_em),
        activo: r.activo ?? true,
      },
      update: {},
    });
  }

  // ---- RF17: quantidade desnormalizada recalculada a partir do histórico ----
  console.log('[migracao] recalcular stock (RF17)...');
  const matsImportados = db.materiais || [];
  for (const m of matsImportados) {
    const agg = await prisma.historicoMaterial.aggregate({
      _sum: { quantidade_movimentada: true },
      where: { material_id: m.id, activo: true },
    });
    const qty = agg._sum.quantidade_movimentada ?? 0;
    await prisma.material.update({ where: { id: m.id }, data: { quantidade: qty } });
  }

  console.log(
    `\n[migracao] concluída: ${(db.utilizadores || []).length} utilizadores, ` +
    `${(db.actividades || []).length} actividades, ${(db.materiais || []).length} materiais importados.`
  );
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[migracao] erro:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});