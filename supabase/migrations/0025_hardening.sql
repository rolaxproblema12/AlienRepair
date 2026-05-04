-- =====================================================
-- AlienRepair — Migración 0025
-- Hardening: RLS gaps + constraints anti-race + lockout admin
-- + v_accounting_daily incluye costo de piezas usadas
-- Aplicar UNA VEZ en SQL Editor de Supabase. Idempotente.
-- =====================================================

-- =====================================================
-- 1. RLS: cash_sessions — solo el dueño o admin pueden modificar/cerrar
-- =====================================================
drop policy if exists cash_sessions_write on public.cash_sessions;
drop policy if exists cash_sessions_insert on public.cash_sessions;
drop policy if exists cash_sessions_update on public.cash_sessions;
drop policy if exists cash_sessions_delete on public.cash_sessions;

create policy cash_sessions_insert on public.cash_sessions
  for insert with check (
    public.is_active_user()
    and (opened_by is null or opened_by = auth.uid())
  );

create policy cash_sessions_update on public.cash_sessions
  for update using (
    public.is_active_user()
    and (opened_by = auth.uid() or public.is_admin())
  ) with check (
    public.is_active_user()
    and (opened_by = auth.uid() or public.is_admin())
  );

create policy cash_sessions_delete on public.cash_sessions
  for delete using (public.is_admin());

-- =====================================================
-- 2. RLS: products — separar insert/update/delete por creator
-- =====================================================
drop policy if exists products_write on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

create policy products_insert on public.products
  for insert with check (
    public.is_active_user()
    and (created_by is null or created_by = auth.uid())
  );

create policy products_update on public.products
  for update using (
    public.is_active_user()
    and (created_by = auth.uid() or public.is_admin())
  ) with check (public.is_active_user());

create policy products_delete on public.products
  for delete using (public.is_admin());

-- =====================================================
-- 3. RLS: parts — mismo patrón que products
-- =====================================================
drop policy if exists parts_write on public.parts;
drop policy if exists parts_insert on public.parts;
drop policy if exists parts_update on public.parts;
drop policy if exists parts_delete on public.parts;

create policy parts_insert on public.parts
  for insert with check (
    public.is_active_user()
    and (created_by is null or created_by = auth.uid())
  );

create policy parts_update on public.parts
  for update using (
    public.is_active_user()
    and (created_by = auth.uid() or public.is_admin())
  ) with check (public.is_active_user());

create policy parts_delete on public.parts
  for delete using (public.is_admin());

-- =====================================================
-- 4. RLS: created_by guard en movimientos
-- =====================================================
drop policy if exists product_movements_insert on public.product_movements;
drop policy if exists product_movements_write on public.product_movements;
create policy product_movements_insert on public.product_movements
  for insert with check (
    public.is_active_user()
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists part_movements_write on public.part_movements;
create policy part_movements_write on public.part_movements
  for insert with check (
    public.is_active_user()
    and (created_by is null or created_by = auth.uid())
  );

-- =====================================================
-- 5. RLS: order_payments — permitir update propio
-- =====================================================
drop policy if exists order_payments_update on public.order_payments;
create policy order_payments_update on public.order_payments
  for update using (
    public.is_active_user()
    and (created_by = auth.uid() or public.is_admin())
  ) with check (public.is_active_user());

-- =====================================================
-- 6. Stock no-negativo a nivel de constraint (defensa contra race)
--    Los triggers BEFORE INSERT siguen siendo el primer escudo;
--    estos CHECK son la red de seguridad si dos inserts pasan en paralelo.
-- =====================================================
do $$ begin
  alter table public.products
    add constraint products_stock_nonneg check (stock >= 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.parts
    add constraint parts_stock_nonneg check (stock >= 0) not valid;
exception when duplicate_object then null;
end $$;

-- Validar para futuros writes; los rows existentes con stock < 0
-- (si por bug histórico los hay) se mantienen sin bloquear la migración.
alter table public.products validate constraint products_stock_nonneg;
alter table public.parts    validate constraint parts_stock_nonneg;

-- =====================================================
-- 7. Anti-lockout: nunca dejar 0 admins activos
-- =====================================================
create or replace function public.prevent_admin_lockout()
returns trigger language plpgsql security definer as $$
declare remaining_admins int;
begin
  -- Solo aplica si la fila resultante deja de ser admin/activo
  if (tg_op = 'UPDATE'
      and (new.role <> 'admin' or new.active = false)
      and old.role = 'admin' and old.active = true)
     or (tg_op = 'DELETE' and old.role = 'admin' and old.active = true)
  then
    select count(*) into remaining_admins
    from public.profiles
    where role = 'admin' and active = true
      and id <> coalesce(new.id, old.id);
    if remaining_admins = 0 then
      raise exception 'No se puede dejar el sistema sin administradores activos.';
    end if;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists profiles_prevent_admin_lockout on public.profiles;
create trigger profiles_prevent_admin_lockout
  before update or delete on public.profiles
  for each row execute function public.prevent_admin_lockout();

-- =====================================================
-- 8. v_accounting_daily — descontar costo de piezas usadas
--    en reparaciones para reflejar la ganancia real.
-- =====================================================
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
  -- Costo de piezas consumidas en reparaciones entregadas, imputado al día
  -- de entrega de la orden (no al día del movimiento, para alinear con ingresos)
  partes_costo as (
    select
      (o.delivered_at at time zone 'America/Mexico_City')::date as dia,
      sum(abs(pm.quantity) * coalesce(pm.unit_purchase_price, 0))::numeric(12,2) as total
    from public.part_movements pm
    join public.orders o on o.id = pm.order_id
    where pm.kind = 'salida'
      and o.status = 'entregado'
      and o.delivered_at is not null
    group by 1
  ),
  dias as (
    select dia from ingresos
    union select dia from refaccion
    union select dia from generales
    union select dia from partes_costo
  )
-- Mantenemos el orden original de columnas (dia, ingresos_*, gastos_*,
-- gastos_total, ganancia) para que `create or replace view` no falle —
-- Postgres no permite reordenar ni insertar columnas en medio. La nueva
-- columna `costo_piezas` se agrega al final.
select
  d.dia,
  coalesce(sum(i.total) filter (where i.kind = 'reparacion'), 0)::numeric(12,2) as ingresos_reparacion,
  coalesce(sum(i.total) filter (where i.kind = 'encargo'), 0)::numeric(12,2) as ingresos_encargo,
  coalesce(sum(i.total) filter (where i.kind = 'accesorio'), 0)::numeric(12,2) as ingresos_accesorio,
  coalesce(sum(i.total), 0)::numeric(12,2) as ingresos_total,
  coalesce(max(r.total), 0)::numeric(12,2) as gastos_refaccion,
  coalesce(max(g.total), 0)::numeric(12,2) as gastos_general,
  (coalesce(max(r.total), 0)
   + coalesce(max(g.total), 0)
   + coalesce(max(pc.total), 0))::numeric(12,2) as gastos_total,
  (coalesce(sum(i.total), 0)
   - coalesce(max(r.total), 0)
   - coalesce(max(g.total), 0)
   - coalesce(max(pc.total), 0))::numeric(12,2) as ganancia,
  coalesce(max(pc.total), 0)::numeric(12,2) as costo_piezas
from dias d
  left join ingresos    i  on i.dia  = d.dia
  left join refaccion   r  on r.dia  = d.dia
  left join generales   g  on g.dia  = d.dia
  left join partes_costo pc on pc.dia = d.dia
group by d.dia
order by d.dia;

-- =====================================================
-- 9. Customers — agregar updated_by para auditoría consistente
-- =====================================================
alter table public.customers
  add column if not exists updated_by uuid references public.profiles(id);

-- =====================================================
-- 10. Updated_by automático en app_settings (si no estaba)
-- =====================================================
create or replace function public.set_updated_by()
returns trigger language plpgsql as $$
begin
  new.updated_by := auth.uid();
  return new;
end$$;

drop trigger if exists app_settings_set_updated_by on public.app_settings;
create trigger app_settings_set_updated_by
  before insert or update on public.app_settings
  for each row execute function public.set_updated_by();
