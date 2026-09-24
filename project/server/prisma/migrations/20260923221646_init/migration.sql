-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DepartamentoTipo" AS ENUM ('DET', 'DCSA', 'GEO', 'outro');

-- CreateEnum
CREATE TYPE "UtilizadorTipo" AS ENUM ('admin', 'professor', 'tecnico', 'coordenador_dlab', 'supervisor', 'chefe_departamento');

-- CreateEnum
CREATE TYPE "ActividadeTipo" AS ENUM ('aula', 'visita', 'projecto', 'estagio');

-- CreateEnum
CREATE TYPE "ActividadeEstado" AS ENUM ('pendente', 'revisado_dlab', 'revisado_supervisor', 'rejeitado');

-- CreateEnum
CREATE TYPE "AgendamentoEstado" AS ENUM ('nao_revisto', 'pendente', 'aprovado_dlab', 'aprovado_supervisor', 'rejeitado');

-- CreateEnum
CREATE TYPE "AprovacaoEtapa" AS ENUM ('dlab', 'supervisor');

-- CreateEnum
CREATE TYPE "AprovacaoDecisao" AS ENUM ('aprovado', 'rejeitado');

-- CreateEnum
CREATE TYPE "MaterialEstado" AS ENUM ('disponivel', 'em_uso', 'manutencao', 'esgotado');

-- CreateEnum
CREATE TYPE "MovimentacaoMotivo" AS ENUM ('consumo_actividade', 'quebra_acidente', 'compra_stock', 'ajuste_inventario', 'outro');

-- CreateEnum
CREATE TYPE "TecnicoTipo" AS ENUM ('validador', 'assistente');

-- CreateEnum
CREATE TYPE "TurnoTipo" AS ENUM ('manha', 'tarde');

-- CreateTable
CREATE TABLE "utilizadores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT,
    "tipo" "UtilizadorTipo" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" SERIAL NOT NULL,
    "departamento" "DepartamentoTipo" NOT NULL,
    "nome" TEXT NOT NULL,
    "abreviacao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudantes" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "curso_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "estudantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso_disciplinas" (
    "id" SERIAL NOT NULL,
    "curso_id" INTEGER NOT NULL,
    "disciplina_id" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "curso_disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_laboratoriais" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_laboratoriais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_material" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categorias_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratorios" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_laboratorial_id" INTEGER NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "laboratorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais" (
    "id" SERIAL NOT NULL,
    "laboratorio_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "quantidade_minima" INTEGER NOT NULL,
    "unidade_id" INTEGER,
    "estado" "MaterialEstado" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_materiais" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "actividade_id" INTEGER,
    "quantidade_movimentada" INTEGER NOT NULL,
    "motivo" "MovimentacaoMotivo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "historico_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_por_id" INTEGER NOT NULL,
    "responsavel_id" INTEGER NOT NULL,
    "laboratorio_id" INTEGER NOT NULL,
    "tipo" "ActividadeTipo" NOT NULL,
    "estado" "ActividadeEstado" NOT NULL DEFAULT 'pendente',
    "observacoes" TEXT,
    "num_participantes" INTEGER NOT NULL DEFAULT 1,
    "precisa_assistente" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividade_tecnico" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "papel" "TecnicoTipo" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "actividade_tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividade_materiais" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "quantidade_estimada" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "actividade_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovacoes" (
    "id" SERIAL NOT NULL,
    "agendamento_id" INTEGER,
    "actividade_id" INTEGER,
    "aprovador_id" INTEGER NOT NULL,
    "etapa" "AprovacaoEtapa" NOT NULL,
    "decisao" "AprovacaoDecisao" NOT NULL,
    "comentario" TEXT,
    "decidido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprovacao_agendamentos" (
    "id" SERIAL NOT NULL,
    "aprovacao_id" INTEGER NOT NULL,
    "agendamento_id" INTEGER NOT NULL,
    "decisao" "AprovacaoDecisao" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aprovacao_agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluxo_aprovacao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "cargos" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fluxo_aprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "hora_inicio" TIMESTAMP(3) NOT NULL,
    "hora_fim" TIMESTAMP(3) NOT NULL,
    "confirmado_professor_em" TIMESTAMP(3),
    "confirmado_tecnico_em" TIMESTAMP(3),
    "realizado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "AgendamentoEstado" NOT NULL DEFAULT 'nao_revisto',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "curso_disciplina_id" INTEGER NOT NULL,
    "tema" TEXT,
    "turno" "TurnoTipo",
    "numero_turma" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "nome_visitante" TEXT NOT NULL,
    "instituicao" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projectos" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "anexo_path" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "projectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estagios" (
    "id" SERIAL NOT NULL,
    "actividade_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "anexo_path" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "estagios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" SERIAL NOT NULL,
    "laboratorio_id" INTEGER NOT NULL,
    "criado_por" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "dados_json" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_email_key" ON "utilizadores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "curso_disciplinas_curso_id_disciplina_id_key" ON "curso_disciplinas"("curso_id", "disciplina_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_laboratoriais_nome_key" ON "unidades_laboratoriais"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_material_nome_key" ON "categorias_material"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_nome_key" ON "unidades"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "actividade_tecnico_actividade_id_papel_key" ON "actividade_tecnico"("actividade_id", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "actividade_materiais_actividade_id_material_id_key" ON "actividade_materiais"("actividade_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacao_agendamentos_aprovacao_id_agendamento_id_key" ON "aprovacao_agendamentos"("aprovacao_id", "agendamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "fluxo_aprovacao_nome_key" ON "fluxo_aprovacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_actividade_id_key" ON "aulas"("actividade_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitas_actividade_id_key" ON "visitas"("actividade_id");

-- CreateIndex
CREATE UNIQUE INDEX "projectos_actividade_id_key" ON "projectos"("actividade_id");

-- CreateIndex
CREATE UNIQUE INDEX "estagios_actividade_id_key" ON "estagios"("actividade_id");

-- AddForeignKey
ALTER TABLE "estudantes" ADD CONSTRAINT "estudantes_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_disciplinas" ADD CONSTRAINT "curso_disciplinas_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_disciplinas" ADD CONSTRAINT "curso_disciplinas_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratorios" ADD CONSTRAINT "laboratorios_unidade_laboratorial_id_fkey" FOREIGN KEY ("unidade_laboratorial_id") REFERENCES "unidades_laboratoriais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "laboratorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_materiais" ADD CONSTRAINT "historico_materiais_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_materiais" ADD CONSTRAINT "historico_materiais_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_materiais" ADD CONSTRAINT "historico_materiais_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "laboratorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividade_tecnico" ADD CONSTRAINT "actividade_tecnico_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividade_tecnico" ADD CONSTRAINT "actividade_tecnico_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividade_materiais" ADD CONSTRAINT "actividade_materiais_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividade_materiais" ADD CONSTRAINT "actividade_materiais_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacao_agendamentos" ADD CONSTRAINT "aprovacao_agendamentos_aprovacao_id_fkey" FOREIGN KEY ("aprovacao_id") REFERENCES "aprovacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacao_agendamentos" ADD CONSTRAINT "aprovacao_agendamentos_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_curso_disciplina_id_fkey" FOREIGN KEY ("curso_disciplina_id") REFERENCES "curso_disciplinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectos" ADD CONSTRAINT "projectos_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagios" ADD CONSTRAINT "estagios_actividade_id_fkey" FOREIGN KEY ("actividade_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagios" ADD CONSTRAINT "estagios_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "estudantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_laboratorio_id_fkey" FOREIGN KEY ("laboratorio_id") REFERENCES "laboratorios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

