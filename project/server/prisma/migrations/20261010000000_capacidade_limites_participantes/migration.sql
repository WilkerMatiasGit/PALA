-- AlterTable
ALTER TABLE "laboratorios" ADD COLUMN     "capacidade" INTEGER NOT NULL DEFAULT 40;

-- CreateTable
CREATE TABLE "limites_participantes" (
    "id" SERIAL NOT NULL,
    "tipo" "ActividadeTipo" NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "limite_activo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "limites_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "limites_participantes_tipo_key" ON "limites_participantes"("tipo");
