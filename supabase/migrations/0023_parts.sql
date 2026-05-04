-- =====================================================
-- AlienRepair — Migración 0023
-- Inventario de piezas (refacciones) + integración con órdenes
-- Aplicar UNA VEZ en SQL Editor de Supabase. Idempotente.
-- =====================================================

-- =====================================================
-- Enums
-- =====================================================
do $$ begin
  create type part_category as enum (
    'placa_centro_carga',
    'auricular',
    'altavoz',
    'flexor',
    'logica',
    'bateria',
    'chasis',
    'tapa',
    'pantalla',
    'huella',
    'camara',
    'bandeja'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type part_movement_kind as enum ('entrada','salida','ajuste');
exception when duplicate_object then null;
end $$;

-- =====================================================
-- Tabla: piezas
-- =====================================================
create table if not exists public.parts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  brand           text not null,
  model           text not null,
  category        part_category not null,
  cost_purchase   numeric(12,2) not null check (cost_purchase >= 0),
  cost_sale       numeric(12,2) not null check (cost_sale >= 0),
  stock           integer not null default 0,
  min_stock       integer,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);

create index if not exists parts_name_trgm on public.parts using gin (name gin_trgm_ops);
create index if not exists parts_brand_idx on public.parts (brand);
create index if not exists parts_category_idx on public.parts (category);
create index if not exists parts_active_idx on public.parts (active) where active;

drop trigger if exists parts_set_updated_at on public.parts;
create trigger parts_set_updated_at
  before update on public.parts
  for each row execute function public.set_updated_at();

-- =====================================================
-- Movimientos de piezas
-- =====================================================
create table if not exists public.part_movements (
  id                   uuid primary key default gen_random_uuid(),
  part_id              uuid not null references public.parts(id) on delete cascade,
  kind                 part_movement_kind not null,
  quantity             integer not null,
  unit_purchase_price  numeric(12,2),
  unit_sale_price      numeric(12,2),
  order_id             uuid references public.orders(id) on delete set null,
  sale_id              uuid references public.sales(id) on delete set null,
  reason               text,
  reference            text,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id)
);

create index if not exists part_movements_part_idx on public.part_movements (part_id, created_at desc);
create index if not exists part_movements_order_idx on public.part_movements (order_id) where order_id is not null;
create index if not exists part_movements_created_idx on public.part_movements (created_at desc);

-- =====================================================
-- Trigger: sincronizar parts.stock con suma de movimientos
-- =====================================================
create or replace function public.sync_part_stock()
returns trigger language plpgsql as $$
declare pid uuid;
begin
  pid := coalesce(new.part_id, old.part_id);
  update public.parts
    set stock = coalesce(
      (select sum(quantity) from public.part_movements where part_id = pid),
      0
    ),
    updated_at = now()
    where id = pid;
  return null;
end$$;

drop trigger if exists part_movements_sync_stock on public.part_movements;
create trigger part_movements_sync_stock
  after insert or update or delete on public.part_movements
  for each row execute function public.sync_part_stock();

-- =====================================================
-- Trigger: prevenir stock negativo en salidas
-- =====================================================
create or replace function public.prevent_negative_part_stock()
returns trigger language plpgsql as $$
declare current_stock int;
begin
  if new.kind = 'salida' then
    select stock into current_stock from public.parts where id = new.part_id;
    if current_stock + new.quantity < 0 then
      raise exception 'Stock insuficiente: hay % piezas, intentas sacar %',
        current_stock, abs(new.quantity);
    end if;
  end if;
  return new;
end$$;

drop trigger if exists part_movements_check_stock on public.part_movements;
create trigger part_movements_check_stock
  before insert on public.part_movements
  for each row execute function public.prevent_negative_part_stock();

-- =====================================================
-- Vista: total de piezas por orden (a precio de venta)
-- =====================================================
create or replace view public.v_order_parts_total as
  select
    pm.order_id,
    sum(abs(pm.quantity) * coalesce(pm.unit_sale_price, 0)) as parts_total,
    sum(abs(pm.quantity) * coalesce(pm.unit_purchase_price, 0)) as parts_cost
  from public.part_movements pm
  where pm.kind = 'salida' and pm.order_id is not null
  group by pm.order_id;

-- =====================================================
-- Reemplazar v_order_balance para incluir piezas en el total
-- (drop forzoso porque cambian columnas y orden — CREATE OR REPLACE
--  no permite renombrar/insertar columnas en medio).
-- =====================================================
drop view if exists public.v_order_balance;

create view public.v_order_balance as
  with parts as (
    select * from public.v_order_parts_total
  ),
  payments as (
    select order_id, sum(amount) as paid_total
    from public.order_payments
    group by order_id
  )
  select
    o.id as order_id,
    o.cost as base_cost,
    coalesce(p.parts_total, 0) as parts_total,
    o.cost + coalesce(p.parts_total, 0) as total,
    coalesce(o.down_payment, 0) + coalesce(pay.paid_total, 0) as paid,
    o.cost + coalesce(p.parts_total, 0)
      - (coalesce(o.down_payment, 0) + coalesce(pay.paid_total, 0)) as balance
  from public.orders o
  left join parts p on p.order_id = o.id
  left join payments pay on pay.order_id = o.id;

-- =====================================================
-- RLS
-- =====================================================
alter table public.parts enable row level security;
alter table public.part_movements enable row level security;

drop policy if exists parts_read on public.parts;
drop policy if exists parts_write on public.parts;
drop policy if exists part_movements_read on public.part_movements;
drop policy if exists part_movements_write on public.part_movements;
drop policy if exists part_movements_admin_delete on public.part_movements;

create policy parts_read on public.parts
  for select using (public.is_active_user());
create policy parts_write on public.parts
  for all using (public.is_active_user()) with check (public.is_active_user());

create policy part_movements_read on public.part_movements
  for select using (public.is_active_user());
create policy part_movements_write on public.part_movements
  for insert with check (public.is_active_user());
create policy part_movements_admin_delete on public.part_movements
  for delete using (public.is_admin());
