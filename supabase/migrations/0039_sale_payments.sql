-- =====================================================
-- AlienRepair — Migración 0039
-- Multi-pago: una venta puede tener N métodos de pago (split tender).
--
-- Mantenemos sales.payment_method como "método principal" (el de mayor
-- monto) para que reports y vistas pre-existentes sigan funcionando
-- sin cambios. La granularidad fina vive en sale_payments.
-- =====================================================

create table if not exists public.sale_payments (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  sucursal_id     uuid not null references public.sucursales(id),
  payment_method  sale_payment_method not null,
  amount          numeric(12,2) not null check (amount > 0),
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists sale_payments_sale_idx on public.sale_payments(sale_id);
create index if not exists sale_payments_sucursal_idx on public.sale_payments(sucursal_id);
create index if not exists sale_payments_method_idx on public.sale_payments(payment_method);

-- =====================================================
-- Backfill: para cada venta existente, crear UN sale_payment row con
-- el method y total actual. Idempotente — solo crea si no existe.
-- =====================================================
insert into public.sale_payments (sale_id, sucursal_id, payment_method, amount)
select s.id, s.sucursal_id, s.payment_method, s.total
from public.sales s
where not exists (
  select 1 from public.sale_payments sp where sp.sale_id = s.id
);

-- =====================================================
-- Trigger: recalcular sales.payment_method al cambiar sale_payments.
-- Toma el método con el monto MÁS GRANDE como "principal" (lo que
-- aparece en historial, badges, reports legacy). Si hay empate, gana
-- el orden alfabético del enum.
-- =====================================================
create or replace function public.sync_sale_primary_method()
returns trigger language plpgsql as $$
declare
  v_sale_id uuid;
  v_primary sale_payment_method;
begin
  v_sale_id := coalesce(new.sale_id, old.sale_id);
  select payment_method into v_primary
  from public.sale_payments
  where sale_id = v_sale_id
  group by payment_method
  order by sum(amount) desc, payment_method
  limit 1;
  if v_primary is not null then
    update public.sales
      set payment_method = v_primary
      where id = v_sale_id and payment_method <> v_primary;
  end if;
  return null;
end$$;

drop trigger if exists sale_payments_sync_primary on public.sale_payments;
create trigger sale_payments_sync_primary
  after insert or update or delete on public.sale_payments
  for each row execute function public.sync_sale_primary_method();

-- =====================================================
-- RLS — mismo patrón que sale_items.
-- =====================================================
alter table public.sale_payments enable row level security;

drop policy if exists sale_payments_read on public.sale_payments;
drop policy if exists sale_payments_write on public.sale_payments;

create policy sale_payments_read on public.sale_payments
  for select using (public.is_active_user_in_sucursal(sucursal_id));
create policy sale_payments_write on public.sale_payments
  for insert with check (public.is_active_user_in_sucursal(sucursal_id));
