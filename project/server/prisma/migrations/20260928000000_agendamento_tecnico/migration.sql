-- Técnicos por AGENDAMENTO + estados rejeitada/realizada:
--  1. AgendamentoTecnico substitui ActividadeTecnico (atribuição por sessão);
--  2. backfill: replicar a atribuição antiga (por atividade) para as sessões já
--     aprovadas pelo Supervisor (os dois papéis validador+assistente, procurando
--     usar a mesma pessoa em ambos quando o assistente não existir);
--  3. removidos actividad_tecnico e actividades.precisa_assistente;
--  4. ActividadeEstado ganha 'rejeitada' e 'realizada' (não usados nesta
--     migração — a normalização dos estados corre na migração seguinte).

-- 1/2. Nova tabela + backfill a partir de actividad_tecnico.
CREATE TABLE "agendamento_tecnico" (
    "id" SERIAL NOT NULL,
    "agendamento_id" INTEGER NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "papel" "TecnicoTipo" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agendamento_tecnico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agendamento_tecnico_agendamento_id_papel_key"
    ON "agendamento_tecnico" ("agendamento_id", "papel");
CREATE INDEX "agendamento_tecnico_utilizador_id_idx"
    ON "agendamento_tecnico" ("utilizador_id");

ALTER TABLE "agendamento_tecnico"
    ADD CONSTRAINT "agendamento_tecnico_agendamento_id_fkey"
    FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agendamento_tecnico"
    ADD CONSTRAINT "agendamento_tecnico_utilizador_id_fkey"
    FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Copia o papel histórico (validador e/ou assistente) para cada sessão aprovada.
INSERT INTO "agendamento_tecnico"
    ("agendamento_id", "utilizador_id", "papel", "criado_em", "actualizado_em", "activo")
SELECT g."id", at."utilizador_id", at."papel", now(), now(), true
FROM "actividade_tecnico" at
JOIN "agendamentos" g
    ON g."actividade_id" = at."actividade_id" AND g."activo" = true
WHERE at."activo" = true
  AND g."estado" = 'aprovado_supervisor';

-- Garante o assistente (mesma pessoa que o validador) quando só existia validador,
-- já que ambos os papéis passam a ser sempre obrigatórios.
INSERT INTO "agendamento_tecnico"
    ("agendamento_id", "utilizador_id", "papel", "criado_em", "actualizado_em", "activo")
SELECT g."id", at."utilizador_id", 'assistente', now(), now(), true
FROM "actividade_tecnico" at
JOIN "agendamentos" g
    ON g."actividade_id" = at."actividade_id" AND g."activo" = true
WHERE at."activo" = true
  AND g."estado" = 'aprovado_supervisor'
  AND NOT EXISTS (
      SELECT 1 FROM "agendamento_tecnico" x
      WHERE x."agendamento_id" = g."id" AND x."papel" = 'assistente'
  );

-- 3. Remoção da tabela antiga e do toggle precisa_assistente.
DROP TABLE "actividade_tecnico";
ALTER TABLE "actividades" DROP COLUMN "precisa_assistente";

-- 4. Novos estados da atividade (valores apenas adicionados; o uso vem na migração seguinte).
ALTER TYPE "ActividadeEstado" ADD VALUE 'rejeitada';
ALTER TYPE "ActividadeEstado" ADD VALUE 'realizada';