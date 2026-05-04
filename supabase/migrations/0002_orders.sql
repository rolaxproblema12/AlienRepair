-- =====================================================
-- AlienRepair — Migración 0002
-- Clientes + Órdenes (reparaciones/encargos/accesorios) + historial
-- =====================================================

create type device_type as enum
  ('celular','tablet','computadora','bocina','tv','consola','otro');

create type order_status as enum
  ('pendiente','en_espera','reparando','listo','entregado');

create type order_kind as enum
  ('reparacion','encargo','accesorio');

-- =====================================================
-- customers
-- =====================================================
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  email       text,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index customers_phone_idx on public.customers (phone);
create index customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create extension if not exists pg_trgm;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =====================================================
-- orders (reparaciones, encargos y accesorios)
-- =====================================================
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  folio               bigint generated always as identity,
  customer_id         uuid not null references public.customers(id) on delete restrict,
  kind                order_kind not null,
  device_type         device_type,
  brand               text,
  model               text,
  problem             text,
  item_description    text,
  cost                numeric(10,2) not null default 0,
  down_payment        numeric(10,2) not null default 0,
  status              order_status not null default 'pendiente',
  received_at         timestamptz not null default now(),
  estimated_delivery  date,
  delivered_at        timestamptz,
  notes               text,
  created_by          uuid references public.profiles(id),
  updated_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index orders_folio_uq on public.orders (folio);
create index orders_customer_idx on public.orders (customer_id);
create index orders_status_idx on public.orders (status);
create index orders_kind_idx on public.orders (kind);
create index orders_estimated_delivery_idx on public.orders (estimated_delivery);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Marcar delivered_at automáticamente cuando pasa a 'entregado'
create or replace function public.orders_sync_delivered()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'entregado' and (old.status is distinct from 'entregado') then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  if new.status <> 'entregado' then
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

create trigger orders_sync_delivered_trg
  before update on public.orders
  for each row execute function public.orders_sync_delivered();

-- =====================================================
-- order_status_history
-- =====================================================
create table public.order_status_history (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  from_status  order_status,
  to_status    order_status not null,
  changed_by   uuid references public.profiles(id),
  changed_at   timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, changed_at);

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
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

create trigger orders_log_status_insert
  after insert on public.orders
  for each row execute function public.log_order_status_change();

create trigger orders_log_status_update
  after update on public.orders
  for each row execute function public.log_order_status_change();

-- =====================================================
-- Vistas
-- =====================================================
create or replace view public.v_customer_active_orders as
  select customer_id, count(*) as active_orders
    from public.orders
    where status <> 'entregado'
    group by customer_id;

create or replace view public.v_overdue_orders as
  select *
    from public.orders
    where status <> 'entregado'
      and estimated_delivery is not null
      and estimated_delivery < current_date;

-- =====================================================
-- RLS
-- =====================================================
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;

-- helper: usuario activo
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and active = true
  );
$$;

-- customers
create policy customers_select on public.customers for select using (public.is_active_user());
create policy customers_insert on public.customers for insert
  with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy customers_update on public.customers for update
  using (public.is_active_user() and (created_by = auth.uid() or public.is_admin()));
create policy customers_delete on public.customers for delete
  using (public.is_admin());

-- orders
create policy orders_select on public.orders for select using (public.is_active_user());
create policy orders_insert on public.orders for insert
  with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy orders_update on public.orders for update
  using (public.is_active_user() and (created_by = auth.uid() or public.is_admin()));
create policy orders_delete on public.orders for delete
  using (public.is_admin());

-- order_status_history (solo lectura, se escribe por triggers)
create policy osh_select on public.order_status_history for select using (public.is_active_user());
