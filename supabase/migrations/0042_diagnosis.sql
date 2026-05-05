-- =====================================================
-- AlienRepair — Migración 0042
-- Diagnóstico técnico:
--   1. Status nuevo `diagnostico` en el ENUM order_status.
--   2. Columna `diagnosis text` en orders.
--
-- Aplicación recomendada: SQL Editor de Supabase (manual).
--
-- ALTER TYPE ... ADD VALUE no se puede ejecutar dentro de una
-- transacción explícita en versiones de Postgres < 12. El runner
-- (scripts/migrate.ts) envuelve cada archivo en BEGIN/COMMIT, así que
-- correr esta migración con `npm run db:migrate` puede fallar.
--
-- Si querés correrla con el runner y falla, parte el ALTER TYPE en su
-- propio archivo y aplicalo manual.
-- =====================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'diagnostico' BEFORE 'en_espera';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS diagnosis text;

COMMENT ON COLUMN public.orders.diagnosis IS
  'Texto del diagnóstico técnico hecho al recibir el equipo. Se ingresa desde el detalle de la OS y opcionalmente se manda por WhatsApp al cliente.';
