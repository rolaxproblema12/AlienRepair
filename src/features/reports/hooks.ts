import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { SaleItemKind, SalePaymentMethod } from '@/features/cash/types';

const REPORT_STALE_TIME = 5 * 60_000;

// =====================================================
// 1. Ventas por período
// =====================================================
export interface SalesReportRow {
  dia: string;
  sucursal_id: string;
  payment_method: SalePaymentMethod;
  kind: SaleItemKind;
  ventas: number;
  ingresos: number;
}

interface SalesReportFilter {
  from: string; // YYYY-MM-DD
  to: string;
  paymentMethod?: SalePaymentMethod | 'all';
}

export function useSalesReport(filter: SalesReportFilter) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['report-sales', sucursalId, filter],
    staleTime: REPORT_STALE_TIME,
    queryFn: async () => {
      let q = supabase
        .from('v_sales_by_period')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .gte('dia', filter.from)
        .lte('dia', filter.to)
        .order('dia', { ascending: true });
      if (filter.paymentMethod && filter.paymentMethod !== 'all') {
        q = q.eq('payment_method', filter.paymentMethod);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SalesReportRow[];
    },
  });
}

// =====================================================
// 2. Top productos vendidos en un rango
// =====================================================
export interface TopProductRow {
  product_id: string;
  name: string;
  sku: string | null;
  sucursal_id: string;
  qty_total: number;
  revenue_total: number;
  last_sold_at: string;
}

interface TopProductsFilter {
  from: string;
  to: string;
  limit?: number;
}

export function useTopProductsReport(filter: TopProductsFilter) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['report-top-products', sucursalId, filter],
    staleTime: REPORT_STALE_TIME,
    queryFn: async () => {
      // v_top_products_sold no tiene rango de fecha — el filter "last_sold_at"
      // aproxima un rango: si la última venta del producto es < from, no nos
      // interesa. Para precisión total habría que crear una function SQL con
      // params; esto es un pragmático MVP.
      const { data, error } = await supabase
        .from('v_top_products_sold')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .gte('last_sold_at', filter.from)
        .lte('last_sold_at', filter.to + 'T23:59:59')
        .order('revenue_total', { ascending: false })
        .limit(filter.limit ?? 20);
      if (error) throw error;
      return (data ?? []) as TopProductRow[];
    },
  });
}

// =====================================================
// 3. Stats de OS por estado
// =====================================================
export interface OrderStatusStatsRow {
  sucursal_id: string;
  status: string;
  ordenes: number;
  ticket_promedio: number;
  dias_promedio_en_sistema: number;
}

export function useOrderStatusStats() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['report-order-status', sucursalId],
    staleTime: REPORT_STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_orders_status_stats')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .order('ordenes', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderStatusStatsRow[];
    },
  });
}

// =====================================================
// 4. Mensual contable (reusa v_accounting_daily de migración 0030)
// =====================================================
export interface AccountingDailyRow {
  dia: string;
  sucursal_id: string;
  ingresos_reparacion: number;
  ingresos_encargo: number;
  ingresos_accesorio: number;
  ingresos_total: number;
  gastos_refaccion: number;
  gastos_general: number;
  gastos_piezas: number;
  gastos_total: number;
  ganancia: number;
}

interface MonthlyFilter {
  /** Formato YYYY-MM, ej: '2026-05' */
  yearMonth: string;
}

export function useMonthlyAccounting(filter: MonthlyFilter) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['report-monthly-accounting', sucursalId, filter.yearMonth],
    staleTime: REPORT_STALE_TIME,
    queryFn: async () => {
      const [year, month] = filter.yearMonth.split('-').map(Number);
      const from = `${filter.yearMonth}-01`;
      // Último día del mes: día 0 del mes siguiente.
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${filter.yearMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('v_accounting_daily')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .gte('dia', from)
        .lte('dia', to)
        .order('dia', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AccountingDailyRow[];
    },
  });
}
