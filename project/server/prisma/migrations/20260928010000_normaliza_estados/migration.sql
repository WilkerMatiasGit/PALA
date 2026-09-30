-- Normaliza os estados das atividades a partir das suas sessões, agora que
-- os valores 'rejeitada'/'realizada' já estão disponíveis na enum activa.

-- 1. realizada: todas as sessões concluídas (realizado OU rejeitado) e ≥1 realizado.
UPDATE "actividades" a SET "estado" = 'realizada'
WHERE a."activo" = true
  AND (SELECT count(*) FROM "agendamentos" g
       WHERE g."activo" = true AND g."actividade_id" = a.id) > 0
  AND NOT EXISTS (
      SELECT 1 FROM "agendamentos" g
      WHERE g."activo" = true AND g."actividade_id" = a.id
        AND NOT (g."realizado" OR g."estado" = 'rejeitado'))
  AND EXISTS (
      SELECT 1 FROM "agendamentos" g
      WHERE g."activo" = true AND g."actividade_id" = a.id AND g."realizado" = true);

-- 2. rejeitada: todas as sessões rejeitadas (e nenhuma realizada).
UPDATE "actividades" a SET "estado" = 'rejeitada'
WHERE a."activo" = true
  AND (SELECT count(*) FROM "agendamentos" g
       WHERE g."activo" = true AND g."actividade_id" = a.id) > 0
  AND NOT EXISTS (
      SELECT 1 FROM "agendamentos" g
      WHERE g."activo" = true AND g."actividade_id" = a.id
        AND (g."estado" <> 'rejeitado' OR g."realizado"));

-- 3. em_andamento: ainda pendente mas já com decisões registadas.
UPDATE "actividades" a SET "estado" = 'em_andamento'
WHERE a."estado" = 'pendente'
  AND EXISTS (
      SELECT 1 FROM "decisoes_agendamento" d
      JOIN "agendamentos" g ON g."id" = d."agendamento_id"
      WHERE g."activo" = true AND g."actividade_id" = a.id);