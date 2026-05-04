-- =====================================================
-- AlienRepair — Migración 0003
-- Fix: trigger log_order_status_change debe ser SECURITY DEFINER
-- para poder insertar en order_status_history (que tiene RLS habilitado
-- y solo policy de SELECT — la intención era que solo triggers escriban).
-- Síntoma anterior: al crear/actualizar una orden el INSERT explotaba con
--   "new row violates row-level security policy for table order_status_history"
-- =====================================================

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (new.id, null, new.status, new.created_by);
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (new.id, old.status, new.status, new.updated_by);
  end if;
  return new;
end;
$$;
