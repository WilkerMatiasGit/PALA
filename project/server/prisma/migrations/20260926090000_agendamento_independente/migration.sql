-- Agendamentos independentes da atividade:
--  1. DecisaoAgendamento substitui Aprovacao + AprovacaoAgendamento (com backfill);
--  2. ActividadeEstado passa a {pendente, em_andamento};
--  3. num_participantes move da atividade para o agendamento (com backfill);
--  4. HistoricoMaterial passa a apontar para o agendamento (com backfill p/ consumo_actividade).

-- 1. Nova tabela de decisões por agendamento.
CREATE TABLE "decisoes_agendamento" (
    "id" SERIAL NOT NULL,
    "agendamento_id" INTEGER NOT NULL,
    "decisor_id" INTEGER NOT NULL,
    "etapa" "AprovacaoEtapa" NOT NULL,
    "decisao" "AprovacaoDecisao" NOT NULL,
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisoes_agendamento_pkey" PRIMARY KEY ("id")
);

-- Backfill: decisões individuais por agendamento (aprovacoes.agendamento_id NOT NULL).
INSERT INTO "decisoes_agendamento" ("agendamento_id", "decisor_id", "etapa", "decisao", "comentario", "criado_em")
SELECT "agendamento_id", "aprovador_id", "etapa", "decisao", "comentario", COALESCE("decidido_em", "criado_em")
FROM "aprovacoes"
WHERE "activo" IS TRUE AND "agendamento_id" IS NOT NULL;

-- Backfill: decisões ao nível da atividade (agendamento_id NULL, ex.: rejeição total) -> cada agendamento da atividade.
INSERT INTO "decisoes_agendamento" ("agendamento_id", "decisor_id", "etapa", "decisao", "comentario", "criado_em")
SELECT g.id, a."aprovador_id", a."etapa", a."decisao", a."comentario", COALESCE(a."decidido_em", a."criado_em")
FROM "aprovacoes" a
JOIN "agendamentos" g ON g."actividade_id" = a."actividade_id" AND g."activo" IS TRUE
WHERE a."activo" IS TRUE AND a."agendamento_id" IS NULL;

-- Backfill: decisões em lote (aprovacao_agendamentos) -> 1 linha por agendamento.
INSERT INTO "decisoes_agendamento" ("agendamento_id", "decisor_id", "etapa", "decisao", "comentario", "criado_em")
SELECT aa."agendamento_id", a."aprovador_id", a."etapa", aa."decisao", a."comentario", COALESCE(a."decidido_em", a."criado_em")
FROM "aprovacao_agendamentos" aa
JOIN "aprovacoes" a ON a."id" = aa."aprovacao_id"
WHERE aa."activo" IS TRUE;

-- Índices e FKs da nova tabela.
CREATE INDEX "decisoes_agendamento_agendamento_id_idx" ON "decisoes_agendamento"("agendamento_id");

ALTER TABLE "decisoes_agendamento"
    ADD CONSTRAINT "decisoes_agendamento_agendamento_id_fkey"
    FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "decisoes_agendamento"
    ADD CONSTRAINT "decisoes_agendamento_decisor_id_fkey"
    FOREIGN KEY ("decisor_id") REFERENCES "utilizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. ActividadeEstado passa a {pendente, em_andamento}.
-- Os valores legados (revisado_dlab / revisado_supervisor / rejeitado) não existem
-- na nova enum, por isso são primeiro colapsados em 'pendente'; o estado real
-- ('em_andamento') é recalculado a seguir a partir das decisões já existentes.
UPDATE "actividades" SET "estado" = 'pendente' WHERE "estado" <> 'pendente';

CREATE TYPE "ActividadeEstado_new" AS ENUM ('pendente', 'em_andamento');

ALTER TABLE "actividades" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "actividades"
    ALTER COLUMN "estado" TYPE "ActividadeEstado_new" USING ("estado"::text::"ActividadeEstado_new");
ALTER TABLE "actividades" ALTER COLUMN "estado" SET DEFAULT 'pendente';

DROP TYPE "ActividadeEstado";
ALTER TYPE "ActividadeEstado_new" RENAME TO "ActividadeEstado";

-- Estado real: em_andamento quando já existir pelo menos uma decisão.
UPDATE "actividades" a
SET "estado" = 'em_andamento'
WHERE EXISTS (
    SELECT 1
    FROM "decisoes_agendamento" d
    JOIN "agendamentos" g ON g."id" = d."agendamento_id"
    WHERE g."actividade_id" = a.id
);

-- 3. num_participantes move para o agendamento (copia o valor atual da atividade).
ALTER TABLE "agendamentos" ADD COLUMN "num_participantes" INTEGER;

UPDATE "agendamentos" g
SET "num_participantes" = a."num_participantes"
FROM "actividades" a
WHERE a."id" = g."actividade_id";

ALTER TABLE "agendamentos"
    ALTER COLUMN "num_participantes" SET NOT NULL,
    ALTER COLUMN "num_participantes" SET DEFAULT 1;

ALTER TABLE "actividades" DROP COLUMN "num_participantes";

-- 4. HistoricoMaterial aponta para o agendamento (backfill: consumo_actividade -> agendamento realizado mais antigo).
ALTER TABLE "historico_materiais" ADD COLUMN "agendamento_id" INTEGER;

UPDATE "historico_materiais" h
SET "agendamento_id" = (
    SELECT g."id"
    FROM "agendamentos" g
    JOIN "actividades" a ON a."id" = g."actividade_id"
    WHERE a."id" = h."actividade_id" AND g."realizado" IS TRUE
    ORDER BY g."hora_inicio"
    LIMIT 1
)
WHERE h."motivo" = 'consumo_actividade' AND h."actividade_id" IS NOT NULL;

ALTER TABLE "historico_materiais" DROP COLUMN "actividade_id";

CREATE INDEX "historico_materiais_agendamento_id_idx" ON "historico_materiais"("agendamento_id");

ALTER TABLE "historico_materiais"
    ADD CONSTRAINT "historico_materiais_agendamento_id_fkey"
    FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Remoção das tabelas legadas (as FKs das outras tabelas caem com elas).
DROP TABLE "aprovacao_agendamentos";
DROP TABLE "aprovacoes";