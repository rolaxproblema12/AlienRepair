-- =====================================================
-- AlienRepair — Migración 0004
-- Gastos (refacciones + generales) y vista contable diaria
-- =====================================================

create type expense_kind as enum ('refaccion', 'general');

-- =====================================================
-- expenses
-- =====================================================
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  kind         expense_kind not null,
  order_id     uuid references public.orders(id) on delete set null,
  description  text not null,
  amount       numeric(10,2) not null check (amount >= 0),
  spent_at     date not null default current_date,
  notes        text,
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint expenses_refaccion_requires_order
    check (kind <> 'refaccion' or order_id is not null)
);

create index expenses_spent_at_idx on public.expenses (spent_at);
create index expenses_kind_idx on public.expenses (kind);
create index expenses_order_idx on public.expenses (order_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- =====================================================
-- Vista contable diaria
-- =====================================================
-- Muestra, por día: ingresos (costos de órdenes entregadas),
-- gastos de refacción (ligados a órdenes), gastos generales,
-- y ganancia = ingresos - gastos totales.
-- También agrega desglose por kind de orden (reparacion/encargo/accesorio).
create or replace view public.v_accounting_daily as
with
  ingresos as (
    select
      (delivered_at at time zone 'America/Mexico_City')::date as dia,
      kind,
      sum(cost)::numeric(12,2) as total
    from public.orders
    where status = 'entregado' and delivered_at is not null
    group by 1, 2
  ),
  refaccion as (
    select spent_at as dia, sum(amount)::numeric(12,2) as total
    from public.expenses
    where kind = 'refaccion'
    group by 1
  ),
  generales as (
    select spent_at as dia, sum(amount)::numeric(12,2) as total
    from public.expenses
    where kind = 'general'
    group by 1
  ),
  dias as (
    select dia from ingresos
    union select dia from refaccion
    union select dia from generales
  )
select
  d.dia,
  coalesce(sum(i.total) filter (where i.kind = 'reparacion'), 0)::numeric(12,2) as ingresos_reparacion,
  coalesce(sum(i.total) filter (where i.kind = 'encargo'), 0)::numeric(12,2) as ingresos_encargo,
  coalesce(sum(i.total) filter (where i.kind = 'accesorio'), 0)::numeric(12,2) as ingresos_accesorio,
  coalesce(sum(i.total), 0)::numeric(12,2) as ingresos_total,
  coalesce(max(r.total), 0)::numeric(12,2) as gastos_refaccion,
  coalesce(max(g.total), 0)::numeric(12,2) as gastos_general,
  (coalesce(max(r.total), 0) + coalesce(max(g.total), 0))::numeric(12,2) as gastos_total,
  (coalesce(sum(i.total), 0) - coalesce(max(r.total), 0) - coalesce(max(g.total), 0))::numeric(12,2) as ganancia
from dias d
  left join ingresos  i on i.dia = d.dia
  left join refaccion r on r.dia = d.dia
  left join generales g on g.dia = d.dia
group by d.dia
order by d.dia;

-- =====================================================
-- RLS
-- =====================================================
alter table public.expenses enable row level security;

create policy expenses_select on public.expenses for select using (public.is_active_user());
create policy expenses_insert on public.expenses for insert
  with check (public.is_active_user() and (created_by is null or created_by = auth.uid()));
create policy expenses_update on public.expenses for update
  using (public.is_active_user() and (created_by = auth.uid() or public.is_admin()));
create policy expenses_delete on public.expenses for delete
  using (public.is_admin());
