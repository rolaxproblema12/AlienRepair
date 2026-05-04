-- =====================================================
-- AlienRepair — Migración 0031
-- Agrega columna color al equipo de la orden de reparación.
-- Útil para identificar visualmente el equipo cuando ingresan
-- varios del mismo modelo.
-- =====================================================

alter table public.orders
  add column if not exists color text;
