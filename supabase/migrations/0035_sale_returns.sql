-- =====================================================
-- AlienRepair — Migración 0035
-- Devoluciones parciales de venta (sale_returns)
--
-- Permite devolver una línea (o parte de ella) de una venta sin tener
-- que cancelar la venta entera. Cancelar dispara cancel_sale_reverse
-- (en 0022_sales.sql:194) que revierte TODOS los items — para refund
-- de 1 producto de 5 necesitamos un trigger separado y un status nuevo
-- 'parcialmente_devuelta' (definido en 0034).
-- =====================================================

create table if not exists public.sale_returns (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null references public.sales(id) on delete cascade,
  sale_item_id      uuid not null references public.sale_items(id) on delete cascade,
  quantity_returned numeric(12,2) not null check (quantity_returned > 0),
  refund_amount     numeric(12,2) not null check (refund_amount > 0),
  reason            text,
  cash_session_id   uuid not null references public.cash_sessions(id),
  sucursal_id       uuid not null references public.sucursales(id),
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

create index if not exists sale_returns_sale_idx on public.sale_returns(sale_id);
create index if not exists sale_returns_item_idx on public.sale_returns(sale_item_id);
create index if not exists sale_returns_sucursal_idx on public.sale_returns(sucursal_id);

-- =====================================================
-- Validación: la suma de qty devueltas no puede exceder qty original.
-- =====================================================
create or replace function public.validate_sale_return()
returns trigger language plpgsql as $$
declare
  v_orig numeric;
  v_already numeric;
begin
  select quantity into v_orig from public.sale_items where id = new.sale_item_id;
  if v_orig is null then
    raise exception 'sale_item % no existe', new.sale_item_id;
  end if;

  select coalesce(sum(quantity_returned), 0) into v_already
    from public.sale_returns
    where sale_item_id = new.sale_item_id;

  if v_already + new.quantity_returned > v_orig then
    raise exception 'Devolución excede cantidad original (orig=%, ya devuelto=%, intento=%)',
      v_orig, v_already, new.quantity_returned;
  end if;
  return new;
end$$;

drop trigger if exists sale_returns_validate on public.sale_returns;
create trigger sale_returns_validate
  before insert on public.sale_returns
  for each row execute function public.validate_sale_return();

-- =====================================================
-- Reversa de stock + payments al insertar devolución.
-- =====================================================
create or replace function public.sale_return_reverse()
returns trigger language plpgsql as $$
declare
  v_item public.sale_items%rowtype;
begin
  select * into v_item from public.sale_items where id = new.sale_item_id;

  if v_item.kind = 'producto' then
    -- entrada de stock: cantidad positiva (sync_product_stock recalcula).
    insert into public.product_movements
      (product_id, kind, quantity, unit_cost_price, unit_sale_price, reason, reference)
    values
      (v_item.product_id,
       'entrada',
       ceil(new.quantity_returned)::int,    -- product_movements.quantity es integer
       v_item.unit_cost,
       v_item.unit_price,
       coalesce('Devolución: ' || new.reason, 'Devolución'),
       'sale_return:' || new.id::text);
  elsif v_item.kind = 'abono_orden' then
    -- pago negativo: revierte el abono de la orden.
    insert into public.order_payments
      (order_id, sale_id, cash_session_id, amount, payment_method, notes)
    values
      (v_item.order_id,
       new.sale_id,
       new.cash_session_id,
       -new.refund_amount,
       'efectivo',
       coalesce('Devolución parcial: ' || new.reason, 'Devolución parcial'));
  end if;

  -- Marcar la venta como parcialmente_devuelta (no como cancelada — eso
  -- dispararía cancel_sale_reverse y revertiría TODA la venta).
  update public.sales
    set status = 'parcialmente_devuelta'
    where id = new.sale_id and status = 'completada';

  return new;
end$$;

drop trigger if exists sale_returns_reverse on public.sale_returns;
create trigger sale_returns_reverse
  after insert on public.sale_returns
  for each row execute function public.sale_return_reverse();

-- =====================================================
-- RLS — mismo patrón que sale_items: lectura para users activos de la
-- sucursal, escritura solo insert (sin update/delete — devoluciones son
-- inmutables; un error se corrige con otra devolución / nota).
-- =====================================================
alter table public.sale_returns enable row level security;

drop policy if exists sale_returns_read on public.sale_returns;
drop policy if exists sale_returns_write on public.sale_returns;

create policy sale_returns_read on public.sale_returns
  for select using (public.is_active_user_in_sucursal(sucursal_id));
create policy sale_returns_write on public.sale_returns
  for insert with check (public.is_active_user_in_sucursal(sucursal_id));
