-- =====================================================
-- AlienRepair — Migración 0032
-- Tabla interna de control para el migration runner
-- (scripts/migrate.ts).
--
-- IMPORTANTE: esta migración debe aplicarse manualmente
-- una sola vez en el SQL editor de Supabase. Después,
-- las nuevas migraciones se corren con `npm run db:migrate`.
--
-- Tras aplicar este archivo, sembrar la tabla con las
-- migraciones existentes via:
--   npm run db:migrate -- --mark-applied 0001_init.sql ... 0031_order_color.sql
-- =====================================================

create schema if not exists app;

create table if not exists app._migrations (
  id text primary key,
  hash text not null,
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);

comment on table app._migrations is
  'Control interno del migration runner (scripts/migrate.ts). Una fila por archivo SQL aplicado, con hash sha256 del contenido.';
