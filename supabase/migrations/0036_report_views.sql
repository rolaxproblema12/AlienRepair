-- =====================================================
-- AlienRepair — Migración 0036
-- Vistas SQL para los reportes de /reportes
--
-- v_accounting_daily ya existe (0030) y se reusa para "Mensual contable".
-- Acá se crean 3 views nuevas para los 3 reportes que faltan:
--   - v_sales_by_period       (ventas por día/método/kind)
--   - v_top_products_sold     (ranking de productos vendidos)
--   - v_orders_status_stats   (count + ticket promedio + dias por estado)
-- =====================================================

-- =====================================================
-- 1. Ventas por día + sucursal + método + kind
-- =====================================================
drop view if exists public.v_sales_by_period;
create view public.v_sales_by_period as
  select
    (s.created_at at time zone 'America/Mexico_City')::date as dia,
    s.sucursal_id,
    s.payment_method,
    si.kind,
    count(distinct s.id)                            as ventas,
    sum(si.line_total)::numeric(12,2)               as ingresos
  from public.sales s
  join public.sale_items si on si.sale_id = s.id
  where s.status in ('completada', 'parcialmente_devuelta')
  group by 1, 2, 3, 4;

-- =====================================================
-- 2. Top productos vendidos (sin filtro de fecha — el cliente filtra
-- por rango uniendo con sales)
-- =====================================================
drop view if exists public.v_top_products_sold;
create view public.v_top_products_sold as
  select
    si.product_id,
    p.name,
    p.sku,
    p.sucursal_id,
    sum(si.quantity)::numeric(12,2)                 as qty_total,
    sum(si.line_total)::numeric(12,2)               as revenue_total,
    max(s.created_at)                               as last_sold_at
  from public.sale_items si
  join public.sales s    on s.id = si.sale_id
  join public.products p on p.id = si.product_id
  where si.kind = 'producto'
    and s.status in ('completada', 'parcialmente_devuelta')
  group by 1, 2, 3, 4;

-- =====================================================
-- 3. Stats de OS por estado (count + ticket promedio + dias en estado)
-- =====================================================
drop view if exists public.v_orders_status_stats;
create view public.v_orders_status_stats as
  select
    sucursal_id,
    status,
    count(*)::int                                              as ordenes,
    avg(cost)::numeric(12,2)                                   as ticket_promedio,
    avg(extract(epoch from (now() - created_at)) / 86400)
      ::numeric(10,1)                                          as dias_promedio_en_sistema
  from public.orders
  group by 1, 2;

-- =====================================================
-- RLS: las views heredan las policies de las tablas subyacentes (sales,
-- sale_items, products, orders) — todas ya filtran por sucursal_id vía
-- is_active_user_in_sucursal(). No se necesitan policies adicionales.
-- =====================================================
