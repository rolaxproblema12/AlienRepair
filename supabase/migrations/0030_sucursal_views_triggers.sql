-- =====================================================
-- Migración 0030: Triggers de propagación + Views con sucursal_id
--
-- 1) Triggers que auto-setean sucursal_id en tablas hijas a partir
--    de la fila padre, para que el cliente no tenga que pasarlo
--    explícitamente y no haya divergencia.
-- 2) Views recreadas para exponer sucursal_id y poder filtrar
--    desde el cliente sin perder el scoping de RLS.
-- =====================================================

-- =====================================================
-- TRIGGERS DE PROPAGACIÓN sucursal_id
-- =====================================================

-- order_status_history hereda de orders
create or replace function public.osh_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.order_id is not null then
    select sucursal_id into new.sucursal_id
      from public.orders where id = new.order_id;
  end if;
  return new;
end;
$$;

create trigger osh_inherit_sucursal_trg
  before insert on public.order_status_history
  for each row execute function public.osh_inherit_sucursal();

-- product_movements hereda de products
create or replace function public.product_movements_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.product_id is not null then
    select sucursal_id into new.sucursal_id
      from public.products where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger product_movements_inherit_sucursal_trg
  before insert on public.product_movements
  for each row execute function public.product_movements_inherit_sucursal();

-- part_movements hereda de parts
create or replace function public.part_movements_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.part_id is not null then
    select sucursal_id into new.sucursal_id
      from public.parts where id = new.part_id;
  end if;
  return new;
end;
$$;

create trigger part_movements_inherit_sucursal_trg
  before insert on public.part_movements
  for each row execute function public.part_movements_inherit_sucursal();

-- sale_items hereda de sales
create or replace function public.sale_items_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.sale_id is not null then
    select sucursal_id into new.sucursal_id
      from public.sales where id = new.sale_id;
  end if;
  return new;
end;
$$;

create trigger sale_items_inherit_sucursal_trg
  before insert on public.sale_items
  for each row execute function public.sale_items_inherit_sucursal();

-- order_payments hereda de orders (o de sales si viene vinculado)
create or replace function public.order_payments_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null then
    if new.order_id is not null then
      select sucursal_id into new.sucursal_id
        from public.orders where id = new.order_id;
    elsif new.sale_id is not null then
      select sucursal_id into new.sucursal_id
        from public.sales where id = new.sale_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger order_payments_inherit_sucursal_trg
  before insert on public.order_payments
  for each row execute function public.order_payments_inherit_sucursal();

-- bot_messages, bot_notifications_sent, bot_surveys heredan del padre
create or replace function public.bot_msg_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.conversation_id is not null then
    select sucursal_id into new.sucursal_id
      from public.bot_conversations where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger bot_msg_inherit_sucursal_trg
  before insert on public.bot_messages
  for each row execute function public.bot_msg_inherit_sucursal();

create or replace function public.bot_notif_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.order_id is not null then
    select sucursal_id into new.sucursal_id
      from public.orders where id = new.order_id;
  end if;
  return new;
end;
$$;

create trigger bot_notif_inherit_sucursal_trg
  before insert on public.bot_notifications_sent
  for each row execute function public.bot_notif_inherit_sucursal();

create trigger bot_surv_inherit_sucursal_trg
  before insert on public.bot_surveys
  for each row execute function public.bot_notif_inherit_sucursal();

-- =====================================================
-- VIEWS recreadas con sucursal_id expuesto
-- =====================================================

-- v_customer_active_orders: agrupa por (customer_id, sucursal_id)
drop view if exists public.v_customer_active_orders;
create view public.v_customer_active_orders as
  select customer_id, sucursal_id, count(*) as active_orders
    from public.orders
   where status <> 'entregado'
   group by customer_id, sucursal_id;

-- v_overdue_orders: SELECT * de orders incluye sucursal_id automáticamente.
-- La definición original ya lo incluye via select *.
drop view if exists public.v_overdue_orders;
create view public.v_overdue_orders as
  select *
    from public.orders
   where status <> 'entregado'
     and status <> 'listo'
     and estimated_delivery is not null
     and estimated_delivery < current_date;

-- v_accounting_daily: ahora agrupa por (dia, sucursal_id)
drop view if exists public.v_accounting_daily;
create view public.v_accounting_daily as
with
  ingresos as (
    select
      (delivered_at at time zone 'America/Mexico_City')::date as dia,
      sucursal_id,
      kind,
      sum(cost)::numeric(12,2) as total
    from public.orders
    where status = 'entregado' and delivered_at is not null
    group by 1, 2, 3
  ),
  refaccion as (
    select spent_at as dia, sucursal_id, sum(amount)::numeric(12,2) as total
    from public.expenses
    where kind = 'refaccion'
    group by 1, 2
  ),
  generales as (
    select spent_at as dia, sucursal_id, sum(amount)::numeric(12,2) as total
    from public.expenses
    where kind = 'general'
    group by 1, 2
  ),
  piezas as (
    -- piezas usadas en órdenes entregadas (gasto real al taller a costo de compra)
    select
      (o.delivered_at at time zone 'America/Mexico_City')::date as dia,
      o.sucursal_id,
      sum(abs(pm.quantity) * coalesce(pm.unit_purchase_price, 0))::numeric(12,2) as total
    from public.part_movements pm
    join public.orders o on o.id = pm.order_id
    where pm.kind = 'salida'
      and o.status = 'entregado'
      and o.delivered_at is not null
    group by 1, 2
  ),
  llaves as (
    select dia, sucursal_id from ingresos
    union select dia, sucursal_id from refaccion
    union select dia, sucursal_id from generales
    union select dia, sucursal_id from piezas
  )
select
  k.dia,
  k.sucursal_id,
  coalesce(sum(i.total) filter (where i.kind = 'reparacion'), 0)::numeric(12,2) as ingresos_reparacion,
  coalesce(sum(i.total) filter (where i.kind = 'encargo'), 0)::numeric(12,2) as ingresos_encargo,
  coalesce(sum(i.total) filter (where i.kind = 'accesorio'), 0)::numeric(12,2) as ingresos_accesorio,
  coalesce(sum(i.total), 0)::numeric(12,2) as ingresos_total,
  coalesce(max(r.total), 0)::numeric(12,2) as gastos_refaccion,
  coalesce(max(g.total), 0)::numeric(12,2) as gastos_general,
  coalesce(max(pz.total), 0)::numeric(12,2) as gastos_piezas,
  (coalesce(max(r.total), 0) + coalesce(max(g.total), 0) + coalesce(max(pz.total), 0))::numeric(12,2) as gastos_total,
  (coalesce(sum(i.total), 0)
    - coalesce(max(r.total), 0)
    - coalesce(max(g.total), 0)
    - coalesce(max(pz.total), 0))::numeric(12,2) as ganancia
from llaves k
left join ingresos i  on i.dia = k.dia and i.sucursal_id = k.sucursal_id
left join refaccion r on r.dia = k.dia and r.sucursal_id = k.sucursal_id
left join generales g on g.dia = k.dia and g.sucursal_id = k.sucursal_id
left join piezas pz   on pz.dia = k.dia and pz.sucursal_id = k.sucursal_id
group by k.dia, k.sucursal_id;

-- v_order_parts_total: agrega sucursal_id (heredada del order)
drop view if exists public.v_order_parts_total cascade;
create view public.v_order_parts_total as
  select
    pm.order_id,
    pm.sucursal_id,
    sum(abs(pm.quantity) * coalesce(pm.unit_sale_price, 0)) as parts_total,
    sum(abs(pm.quantity) * coalesce(pm.unit_purchase_price, 0)) as parts_cost
  from public.part_movements pm
  where pm.kind = 'salida' and pm.order_id is not null
  group by pm.order_id, pm.sucursal_id;

-- v_order_balance: recreada con sucursal_id expuesto
create view public.v_order_balance as
  with parts as (
    select order_id, parts_total
      from public.v_order_parts_total
  ),
  payments as (
    select order_id, sum(amount) as paid_total
      from public.order_payments
     group by order_id
  )
  select
    o.id as order_id,
    o.sucursal_id,
    o.cost as base_cost,
    coalesce(p.parts_total, 0) as parts_total,
    o.cost + coalesce(p.parts_total, 0) as total,
    coalesce(o.down_payment, 0) + coalesce(pay.paid_total, 0) as paid,
    o.cost + coalesce(p.parts_total, 0)
      - (coalesce(o.down_payment, 0) + coalesce(pay.paid_total, 0)) as balance
  from public.orders o
  left join parts p on p.order_id = o.id
  left join payments pay on pay.order_id = o.id;
