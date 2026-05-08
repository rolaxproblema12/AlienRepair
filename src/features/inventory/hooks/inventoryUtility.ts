import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';

export interface UtilityRow {
  product_id: string;
  product_name: string;
  category_name: string | null;
  units_sold: number;
  utility_total: number;
}

export function useInventoryUtility(from: string, to: string) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['inventory-utility', sucursalId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_movements')
        .select(
          'product_id, quantity, unit_sale_price, unit_cost_price, products(name, category:product_categories(name))',
        )
        .eq('sucursal_id', sucursalId)
        .eq('kind', 'salida')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .not('unit_sale_price', 'is', null)
        .not('unit_cost_price', 'is', null);
      if (error) throw error;

      const map = new Map<string, UtilityRow>();
      let total = 0;
      for (const m of data ?? []) {
        const row = m as unknown as {
          product_id: string;
          quantity: number;
          unit_sale_price: number;
          unit_cost_price: number;
          products: { name: string; category: { name: string } | null } | null;
        };
        const units = Math.abs(row.quantity);
        const utility = units * (Number(row.unit_sale_price) - Number(row.unit_cost_price));
        total += utility;
        const existing = map.get(row.product_id);
        if (existing) {
          existing.units_sold += units;
          existing.utility_total += utility;
        } else {
          map.set(row.product_id, {
            product_id: row.product_id,
            product_name: row.products?.name ?? '—',
            category_name: row.products?.category?.name ?? null,
            units_sold: units,
            utility_total: utility,
          });
        }
      }
      const byProduct = Array.from(map.values()).sort(
        (a, b) => b.utility_total - a.utility_total,
      );
      return { total, byProduct };
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}
