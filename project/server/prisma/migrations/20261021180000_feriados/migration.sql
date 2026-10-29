CREATE TYPE "FeriadoTipo" AS ENUM ('feriado', 'feriado_movel', 'ponte', 'tolerancia');
CREATE TABLE "feriados" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "tipo" "FeriadoTipo" NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_em" TIMESTAMP(3) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "feriados_data_key" ON "feriados"("data");
ALTER TABLE "configuracoes_gerais" ADD COLUMN "permitir_feriados" BOOLEAN NOT NULL DEFAULT false;
