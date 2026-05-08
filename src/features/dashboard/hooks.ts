import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { TZ } from '@/lib/dates';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';

export interface DashboardRevenuePoint {
  dia: string;
  ingresos_total: number;
}

export function useDashboardRevenue7d() {
  const sucursalId = useScopedSucursalId();
  const today = toZonedTime(new Date(), TZ);
  const from = format(subDays(today, 6), 'yyyy-MM-dd');
  const to = format(today, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['dashboard-revenue-7d', sucursalId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_accounting_daily')
        .select('dia, ingresos_total')
        .eq('sucursal_id', sucursalId)
        .gte('dia', from)
        .lte('dia', to)
        .order('dia', { ascending: true });
      if (error) throw error;
      const map = new Map<string, number>(
        (data ?? []).map((r) => [r.dia, Number(r.ingresos_total)]),
      );
      const points: DashboardRevenuePoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(today, i), 'yyyy-MM-dd');
        points.push({ dia: day, ingresos_total: map.get(day) ?? 0 });
      }
      return points;
    },
    staleTime: STALE_TIMES.SLOW,
  });
}
