-- =====================================================
-- AlienRepair — Migración 0037
-- Empleados + comisiones por venta
--
-- Agrega commission_rate en profiles (0..1) y crea la vista
-- v_employee_sales_monthly que agrupa ventas por empleado, sucursal y
-- mes, calculando comisión = ingresos * rate.
-- =====================================================

alter table public.profiles
  add column if not exists commission_rate numeric(5,4) not null default 0
    check (commission_rate >= 0 and commission_rate <= 1);

comment on column public.profiles.commission_rate is
  'Porcentaje de comisión sobre ventas (0..1). Ej: 0.05 = 5%. Configurable por admin en /admin/users.';

-- =====================================================
-- v_employee_sales_monthly
-- Una row por empleado × sucursal × mes con totales y comisión.
-- =====================================================
drop view if exists public.v_employee_sales_monthly;
create view public.v_employee_sales_monthly as
  select
    s.created_by                              as employee_id,
    s.sucursal_id,
    to_char(
      (s.created_at at time zone 'America/Mexico_City'),
      'YYYY-MM'
    )                                          as period_month,
    p.email                                   as employee_email,
    p.full_name                               as employee_name,
    p.commission_rate                         as commission_rate,
    count(*)::int                             as ventas_count,
    sum(s.total)::numeric(12,2)               as ingresos_total,
    (sum(s.total) * coalesce(p.commission_rate, 0))::numeric(12,2)
                                               as commission_amount
  from public.sales s
  join public.profiles p on p.id = s.created_by
  where s.status in ('completada', 'parcialmente_devuelta')
    and s.created_by is not null
  group by 1, 2, 3, 4, 5, 6;

comment on view public.v_employee_sales_monthly is
  'Ranking mensual de ventas por empleado con cálculo de comisión.
   La comisión se aplica sobre `sales.total` antes de devoluciones —
   los reembolsos parciales NO descuentan automáticamente. Los admins
   ajustan manualmente si hay disputas.';
