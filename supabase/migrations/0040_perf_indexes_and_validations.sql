-- =====================================================
-- AlienRepair — Migración 0040
-- Performance + integridad:
--   1. Índices que faltaban en filtros frecuentes.
--   2. Validación de overpayment en sale_payments.
--
-- Nota: NO se incluyen ALTER FUNCTION ... STABLE para is_admin/
-- is_active_user/is_active_user_in_sucursal/user_can_access_sucursal
-- porque ya fueron declaradas STABLE en 0001/0002/0026.
-- =====================================================

-- =====================================================
-- 1) Índices que faltan en filtros frecuentes
-- (cruzados con queries de hooks en src/features/*)
-- =====================================================

-- customers: RLS evalúa sucursal_id en cada lectura; antes era seq scan.
create index if not exists customers_sucursal_id_idx
  on public.customers(sucursal_id);

-- sales: lista de ventas siempre ordena por created_at desc filtrando por sucursal.
create index if not exists sales_sucursal_created_idx
  on public.sales(sucursal_id, created_at desc);

-- orders: filtros por status combinado con sucursal son recurrentes.
create index if not exists orders_sucursal_status_idx
  on public.orders(sucursal_id, status);

-- orders overdue: parcial — solo importa cuando NO está listo/entregado.
-- Reduce el índice ~80% y acelera useOverdueOrders / useOverdueOrdersCount.
create index if not exists orders_sucursal_estimated_idx
  on public.orders(sucursal_id, estimated_delivery)
  where status not in ('listo', 'entregado');

-- expenses: filtros por kind en useExpenses + reportes mensuales.
create index if not exists expenses_sucursal_kind_idx
  on public.expenses(sucursal_id, kind);

-- product_movements: kind se filtra en useInventoryUtility y reportes.
create index if not exists product_movements_kind_idx
  on public.product_movements(kind);

-- sales activas (parcial): los reportes solo cuentan completada/parcialmente
-- devuelta. Excluye canceladas que no aportan a métricas.
create index if not exists sales_status_active_idx
  on public.sales(sucursal_id, status)
  where status in ('completada', 'parcialmente_devuelta');

-- =====================================================
-- 2) sale_payments: validar que la suma no exceda sales.total
--
-- La UI ya valida en useCreateSale, pero esto es defensa en profundidad
-- por si algún día se agrega edición manual o una integración externa.
-- Se ejecuta BEFORE INSERT/UPDATE.
-- =====================================================
create or replace function public.validate_sale_payments_sum()
returns trigger language plpgsql as $$
declare
  v_total numeric(12,2);
  v_paid  numeric(12,2);
begin
  select total into v_total from public.sales where id = new.sale_id;
  select coalesce(sum(amount), 0) into v_paid
    from public.sale_payments
    where sale_id = new.sale_id
      and id <> coalesce(new.id, gen_random_uuid());
  -- + 0.01 de tolerancia por errores de redondeo en sumas grandes.
  if v_paid + new.amount > v_total + 0.01 then
    raise exception 'Pagos exceden total de venta (total=%, ya pagado=%, intento=%)',
      v_total, v_paid, new.amount;
  end if;
  return new;
end$$;

drop trigger if exists sale_payments_validate_sum on public.sale_payments;
create trigger sale_payments_validate_sum
  before insert or update on public.sale_payments
  for each row execute function public.validate_sale_payments_sum();
