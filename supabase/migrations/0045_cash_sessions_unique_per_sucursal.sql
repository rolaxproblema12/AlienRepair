-- =====================================================
-- Migración 0045: cash_sessions unique index per-sucursal
--
-- El index original `cash_sessions_one_open_idx` (creado en 0022) era:
--
--   create unique index cash_sessions_one_open_idx
--     on public.cash_sessions (status) where status = 'open';
--
-- O sea UNIQUE GLOBAL: si CUALQUIER sucursal tiene una sesión abierta,
-- ninguna otra sucursal puede abrir la suya (UNIQUE violation).
--
-- Multi-sucursal (0026-0030) agregó la columna `sucursal_id` pero NO
-- recreó el index — el comentario en 0030 incluso lo confirma.
--
-- En la práctica el bug NO se manifestó porque el usuario tenía una sola
-- PC operando a la vez, pero al escalar a múltiples sucursales en
-- paralelo bloquearía aperturas legítimas.
--
-- Fix: drop el index global, crear uno per-sucursal.
-- =====================================================

-- Pre-validación: si hay más de una sesión abierta por sucursal en este
-- momento (lo que sería imposible con el index nuevo), abortar para que
-- el admin las cierre primero.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from (
      select sucursal_id
        from public.cash_sessions
       where status = 'open'
       group by sucursal_id
      having count(*) > 1
    ) x;
  if v_count > 0 then
    raise exception 'Hay % sucursales con más de una sesión abierta. Cerrá las duplicadas antes de aplicar 0045.', v_count;
  end if;
end $$;

drop index if exists public.cash_sessions_one_open_idx;

create unique index if not exists cash_sessions_one_open_per_sucursal_idx
  on public.cash_sessions (sucursal_id) where status = 'open';

comment on index public.cash_sessions_one_open_per_sucursal_idx is
  'Una sola sesión de caja abierta por sucursal a la vez. Reemplaza al global cash_sessions_one_open_idx que bloqueaba aperturas cross-sucursal.';
