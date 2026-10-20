-- CreateTable
CREATE TABLE "configuracoes_gerais" (
    "id" SERIAL NOT NULL,
    "permitir_fim_semana" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_em" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "configuracoes_gerais_pkey" PRIMARY KEY ("id")
);
