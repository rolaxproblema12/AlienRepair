-- =====================================================
-- AlienRepair — Migración 0011
-- Encargos y accesorios pasan a solo 2 estatus reales:
-- 'pendiente' y 'entregado' (retrasado es derivado).
--
-- Mapeo de datos existentes:
--   'en_espera' | 'reparando' -> 'pendiente'
--   'listo'                   -> 'entregado'
--
-- Reparaciones conservan los 5 estatus, no se tocan.
-- =====================================================

update public.orders
  set status = 'pendiente'
  where kind in ('encargo','accesorio')
    and status in ('en_espera','reparando');

update public.orders
  set status = 'entregado',
      delivered_at = coalesce(delivered_at, now())
  where kind in ('encargo','accesorio')
    and status = 'listo';
