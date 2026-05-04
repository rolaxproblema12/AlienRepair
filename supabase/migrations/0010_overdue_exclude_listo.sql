-- =====================================================
-- AlienRepair — Migración 0010
-- Fix: una orden en estatus 'listo' o 'entregado' ya no
-- debe contar como retrasada.
-- =====================================================

create or replace view public.v_overdue_orders as
  select *
    from public.orders
    where status not in ('listo','entregado')
      and estimated_delivery is not null
      and estimated_delivery < current_date;
