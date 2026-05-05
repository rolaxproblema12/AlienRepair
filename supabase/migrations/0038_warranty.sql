-- =====================================================
-- AlienRepair — Migración 0038
-- Garantía con seguimiento de reclamos
--
-- Permite que el shop configure días de garantía por sucursal y que
-- una OS se marque como "reclamo de garantía" de otra entregada.
-- El front muestra alerta cuando se crea una OS para un cliente que
-- tiene una entregada reciente (dentro del período de garantía).
-- =====================================================

alter table public.sucursales
  add column if not exists warranty_days int not null default 30
    check (warranty_days >= 0 and warranty_days <= 730);

comment on column public.sucursales.warranty_days is
  'Días de garantía sobre reparaciones entregadas. UI alerta al crear
   nueva OS para un cliente con orden entregada dentro de este periodo.';

alter table public.orders
  add column if not exists warranty_claim_of uuid
    references public.orders(id) on delete set null;

create index if not exists orders_warranty_claim_idx
  on public.orders(warranty_claim_of)
  where warranty_claim_of is not null;

comment on column public.orders.warranty_claim_of is
  'Si esta OS es un reclamo de garantía, apunta a la OS original
   entregada. NULL = OS normal.';
