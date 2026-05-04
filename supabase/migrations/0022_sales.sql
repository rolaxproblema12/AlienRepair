-- =====================================================
-- AlienRepair — Migración 0022
-- Módulo de caja y ventas: cash_sessions, sales, sale_items, order_payments.
-- Aplicar UNA VEZ en SQL Editor de Supabase. Idempotente.
-- =====================================================

-- =====================================================
-- Enums
-- =====================================================
do $$ begin
  create type cash_session_status as enum ('open','closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sale_status as enum ('completada','cancelada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sale_payment_method as enum ('efectivo','tarjeta','transferencia');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sale_item_kind as enum ('producto','abono_orden');
exception when duplicate_object then null;
end $$;

-- =====================================================
-- Sesiones de caja
-- =====================================================
create table if not exists public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  status          cash_session_status not null default 'open',
  opened_at       timestamptz not null default now(),
  opened_by       uuid references auth.users(id),
  opening_amount  numeric(12,2) not null check (opening_amount >= 0),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id),
  expected_cash   numeric(12,2),
  counted_cash    numeric(12,2),
  difference      numeric(12,2),
  closing_notes   text
);

-- Solo puede haber una sesión `open` a la vez
create unique index if not exists cash_sessions_one_open_idx
  on public.cash_sessions (status) where status = 'open';

create index if not exists cash_sessions_opened_at_idx
  on public.cash_sessions (opened_at desc);

-- =====================================================
-- Ventas
-- =====================================================
create sequence if not exists sales_folio_seq;

create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  folio           integer not null default nextval('sales_folio_seq') unique,
  cash_session_id uuid not null references public.cash_sessions(id),
  customer_id     uuid references public.customers(id) on delete set null,
  subtotal        numeric(12,2) not null default 0,
  iva_total       numeric(12,2) not null default 0,
  discount_total  numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0 check (total >= 0),
  payment_method  sale_payment_method not null,
  notes           text,
  status          sale_status not null default 'completada',
  cancelled_at    timestamptz,
  cancelled_by    uuid references auth.users(id),
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists sales_session_idx on public.sales (cash_session_id);
create index if not exists sales_created_idx on public.sales (created_at desc);
create index if not exists sales_status_idx on public.sales (status);
create index if not exists sales_customer_idx on public.sales (customer_id);

-- =====================================================
-- Líneas de venta
-- =====================================================
create table if not exists public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales(id) on delete cascade,
  kind         sale_item_kind not null,
  product_id   uuid references public.products(id) on delete restrict,
  order_id     uuid references public.orders(id) on delete restrict,
  description  text not null,
  quantity     numeric(12,2) not null default 1 check (quantity > 0),
  unit_price   numeric(12,2) not null,
  unit_cost    numeric(12,2),                       -- snapshot del costo
  iva_rate     numeric(5,4) not null default 0,
  discount     numeric(12,2) not null default 0 check (discount >= 0),
  line_total   numeric(12,2) not null,
  -- Una línea de producto referencia un producto; una línea de abono referencia una orden
  check (
    (kind = 'producto' and product_id is not null and order_id is null) or
    (kind = 'abono_orden' and order_id is not null and product_id is null)
  )
);

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);
create index if not exists sale_items_order_idx on public.sale_items (order_id);

-- =====================================================
-- Abonos a órdenes (independientes o vía venta)
-- =====================================================
create table if not exists public.order_payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  sale_id         uuid references public.sales(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  amount          numeric(12,2) not null check (amount <> 0),
  payment_method  sale_payment_method not null,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists order_payments_order_idx on public.order_payments (order_id, created_at desc);
create index if not exists order_payments_sale_idx on public.order_payments (sale_id);
create index if not exists order_payments_session_idx on public.order_payments (cash_session_id);

-- =====================================================
-- Validar que la sesión esté abierta antes de crear venta
-- =====================================================
create or replace function public.validate_sale_session()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.cash_sessions
      where id = new.cash_session_id and status = 'open'
  ) then
    raise exception 'La sesión de caja no está abierta';
  end if;
  return new;
end$$;

drop trigger if exists sales_validate_session on public.sales;
create trigger sales_validate_session
  before insert on public.sales
  for each row execute function public.validate_sale_session();

-- =====================================================
-- Trigger: al insertar sale_item kind='producto', registra movimiento de salida
-- =====================================================
create or replace function public.sale_item_register_movement()
returns trigger language plpgsql as $$
declare folio_text text;
        sale_creator uuid;
begin
  if new.kind = 'producto' then
    select 'VTA-' || s.folio, s.created_by
      into folio_text, sale_creator
      from public.sales s where s.id = new.sale_id;

    insert into public.product_movements (
      product_id, kind, quantity,
      unit_sale_price, unit_cost_price,
      reason, reference, created_by
    ) values (
      new.product_id, 'salida', -1 * new.quantity,
      new.unit_price, coalesce(new.unit_cost, 0),
      'Venta', folio_text, sale_creator
    );
  elsif new.kind = 'abono_orden' then
    insert into public.order_payments (
      order_id, sale_id, cash_session_id,
      amount, payment_method, notes, created_by
    )
    select
      new.order_id, new.sale_id, s.cash_session_id,
      new.line_total, s.payment_method,
      'Abono via venta VTA-' || s.folio,
      s.created_by
    from public.sales s where s.id = new.sale_id;
  end if;
  return null;
end$$;

drop trigger if exists sale_items_register_movement on public.sale_items;
create trigger sale_items_register_movement
  after insert on public.sale_items
  for each row execute function public.sale_item_register_movement();

-- =====================================================
-- Trigger: cancelar venta → reintegra stock + revierte abonos
-- =====================================================
create or replace function public.cancel_sale_reverse()
returns trigger language plpgsql as $$
declare item record;
        folio_text text := 'VTA-CANCEL-' || new.folio;
begin
  if old.status = 'completada' and new.status = 'cancelada' then
    for item in
      select * from public.sale_items where sale_id = new.id
    loop
      if item.kind = 'producto' then
        insert into public.product_movements (
          product_id, kind, quantity,
          reason, reference, created_by
        ) values (
          item.product_id, 'entrada', item.quantity,
          'Cancelación de venta', folio_text, new.cancelled_by
        );
      elsif item.kind = 'abono_orden' then
        insert into public.order_payments (
          order_id, sale_id, cash_session_id,
          amount, payment_method, notes, created_by
        )
        select
          item.order_id, new.id, s.cash_session_id,
          -1 * item.line_total, s.payment_method,
          'Reverso de abono por cancelación de ' || folio_text,
          new.cancelled_by
        from public.sales s where s.id = new.id;
      end if;
    end loop;
  end if;
  return null;
end$$;

drop trigger if exists sales_cancel_reverse on public.sales;
create trigger sales_cancel_reverse
  after update of status on public.sales
  for each row execute function public.cancel_sale_reverse();

-- =====================================================
-- Vista: balance por orden (suma de pagos vs costo total)
-- =====================================================
create or replace view public.v_order_balance as
  select
    o.id as order_id,
    o.cost as total,
    coalesce(o.down_payment, 0) + coalesce((
      select sum(amount)
      from public.order_payments
      where order_id = o.id
    ), 0) as paid,
    o.cost - (coalesce(o.down_payment, 0) + coalesce((
      select sum(amount)
      from public.order_payments
      where order_id = o.id
    ), 0)) as balance
  from public.orders o;

-- =====================================================
-- RLS
-- =====================================================
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.order_payments enable row level security;

drop policy if exists cash_sessions_read on public.cash_sessions;
drop policy if exists cash_sessions_write on public.cash_sessions;
drop policy if exists sales_read on public.sales;
drop policy if exists sales_write on public.sales;
drop policy if exists sale_items_read on public.sale_items;
drop policy if exists sale_items_write on public.sale_items;
drop policy if exists order_payments_read on public.order_payments;
drop policy if exists order_payments_write on public.order_payments;
drop policy if exists order_payments_admin_delete on public.order_payments;

create policy cash_sessions_read on public.cash_sessions
  for select using (public.is_active_user());
create policy cash_sessions_write on public.cash_sessions
  for all using (public.is_active_user()) with check (public.is_active_user());

create policy sales_read on public.sales
  for select using (public.is_active_user());
create policy sales_write on public.sales
  for all using (public.is_active_user()) with check (public.is_active_user());

create policy sale_items_read on public.sale_items
  for select using (public.is_active_user());
create policy sale_items_write on public.sale_items
  for insert with check (public.is_active_user());

create policy order_payments_read on public.order_payments
  for select using (public.is_active_user());
create policy order_payments_write on public.order_payments
  for insert with check (public.is_active_user());
create policy order_payments_admin_delete on public.order_payments
  for delete using (public.is_admin());
