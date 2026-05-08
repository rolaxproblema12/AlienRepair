import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateProductRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { MovementInput } from '../schemas';
import type { ProductMovement } from '../types';

export function useProductMovements(productId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['product-movements', sucursalId, productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_movements')
        .select(
          'id, product_id, kind, quantity, unit_sale_price, unit_cost_price, reason, reference, created_at, created_by',
        )
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProductMovement[];
    },
    enabled: !!productId,
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useRecordMovement(productId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MovementInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // Para snapshot de venta, leer precios actuales
      let unit_sale_price: number | null = null;
      let unit_cost_price: number | null = null;
      if (values.kind === 'salida') {
        const { data: p, error: pErr } = await supabase
          .from('products')
          .select('sale_price, cost_price')
          .eq('id', productId)
          .single();
        if (pErr) throw pErr;
        unit_sale_price = Number(p.sale_price);
        unit_cost_price = Number(p.cost_price);
      }

      const absQty = Math.abs(values.quantity);
      let signed: number;
      if (values.kind === 'entrada') signed = absQty;
      else if (values.kind === 'salida') signed = -absQty;
      else signed = values.quantity; // ajuste — el signo lo decide el usuario

      const { data, error } = await supabase
        .from('product_movements')
        .insert({
          product_id: productId,
          sucursal_id: sucursalId,
          kind: values.kind,
          quantity: signed,
          unit_sale_price,
          unit_cost_price,
          reason: values.reason ?? null,
          reference: values.reference ?? null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProductMovement;
    },
    onSuccess: () => {
      invalidateProductRelated(qc, sucursalId, { productId });
    },
  });
}
