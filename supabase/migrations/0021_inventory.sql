-- =====================================================
-- AlienRepair — Migración 0021
-- Módulo de inventario: categorías, productos y movimientos
-- =====================================================
-- Aplicar UNA VEZ a mano en el SQL Editor de Supabase.
-- Dependencias: extensión pg_trgm (ya instalada por 0014).
-- Helpers RLS: is_active_user(), is_admin() (definidos en 0001/0002).
-- Trigger genérico set_updated_at() (definido en 0001).

-- =====================================================
-- Enum del tipo de movimiento
-- =====================================================
do $$ begin
  create type product_movement_kind as enum ('entrada','salida','ajuste');
exception when duplicate_object then null;
end $$;

-- =====================================================
-- Tabla: categorías
-- =====================================================
create table if not exists public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- =====================================================
-- Tabla: productos
-- =====================================================
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  barcode         text unique,
  name            text not null,
  description     text,
  category_id     uuid not null references public.product_categories(id) on delete restrict,
  brand           text,
  model           text,
  supplier        text,
  cost_price      numeric(12,2) not null check (cost_price >= 0),
  sale_price      numeric(12,2) not null check (sale_price >= 0),
  iva_rate        numeric(5,4)  not null default 0.16 check (iva_rate >= 0 and iva_rate <= 1),
  stock           integer not null default 0,
  min_stock       integer,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);

create index if not exists products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (active) where active;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- =====================================================
-- Tabla: movimientos (audit log + fuente del stock)
-- =====================================================
create table if not exists public.product_movements (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  kind              product_movement_kind not null,
  quantity          integer not null,
  unit_sale_price   numeric(12,2),
  unit_cost_price   numeric(12,2),
  reason            text,
  reference         text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create index if not exists product_movements_product_idx
  on public.product_movements (product_id, created_at desc);
create index if not exists product_movements_created_idx
  on public.product_movements (created_at desc);

-- =====================================================
-- Trigger: mantener products.stock sincronizado con la suma de movimientos
-- =====================================================
create or replace function public.sync_product_stock()
returns trigger language plpgsql as $$
declare pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products
    set stock = coalesce(
      (select sum(quantity) from public.product_movements where product_id = pid),
      0
    ),
    updated_at = now()
    where id = pid;
  return null;
end$$;

drop trigger if exists product_movements_sync_stock on public.product_movements;
create trigger product_movements_sync_stock
  after insert or update or delete on public.product_movements
  for each row execute function public.sync_product_stock();

-- =====================================================
-- Trigger: prevenir stock negativo en salidas
-- =====================================================
create or replace function public.prevent_negative_stock()
returns trigger language plpgsql as $$
declare current_stock int;
begin
  if new.kind = 'salida' then
    select stock into current_stock from public.products where id = new.product_id;
    if current_stock + new.quantity < 0 then
      raise exception 'Stock insuficiente: hay % unidades, intentas sacar %',
        current_stock, abs(new.quantity);
    end if;
  end if;
  return new;
end$$;

drop trigger if exists product_movements_check_stock on public.product_movements;
create trigger product_movements_check_stock
  before insert on public.product_movements
  for each row execute function public.prevent_negative_stock();

-- =====================================================
-- RLS
-- =====================================================
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_movements enable row level security;

drop policy if exists product_categories_read on public.product_categories;
drop policy if exists product_categories_admin_write on public.product_categories;
drop policy if exists products_read on public.products;
drop policy if exists products_write on public.products;
drop policy if exists product_movements_read on public.product_movements;
drop policy if exists product_movements_insert on public.product_movements;
drop policy if exists product_movements_admin_modify on public.product_movements;

create policy product_categories_read on public.product_categories
  for select using (public.is_active_user());
create policy product_categories_admin_write on public.product_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products
  for select using (public.is_active_user());
create policy products_write on public.products
  for all using (public.is_active_user()) with check (public.is_active_user());

create policy product_movements_read on public.product_movements
  for select using (public.is_active_user());
create policy product_movements_insert on public.product_movements
  for insert with check (public.is_active_user());
create policy product_movements_admin_modify on public.product_movements
  for delete using (public.is_admin());
