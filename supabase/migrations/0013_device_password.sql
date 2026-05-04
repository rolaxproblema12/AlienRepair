-- =====================================================
-- AlienRepair — Migración 0013
-- Nueva columna para guardar contraseña / PIN / patrón de
-- celulares recibidos. Solo se muestra en la UI cuando el
-- tipo de dispositivo es 'celular'.
-- =====================================================

alter table public.orders
  add column if not exists device_password text;
