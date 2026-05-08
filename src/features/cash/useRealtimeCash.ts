import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  invalidatePartRelated,
  invalidateProductRelated,
  invalidateSaleRelated,
} from '@/lib/queryInvalidation';
import { useMaybeSucursalId } from '@/features/sucursales/useScopedSucursalId';

interface RowWithOrderId {
  order_id?: string | null;
  sale_id?: string | null;
  product_id?: string | null;
  id?: string;
}

/**
 * Sync multi-PC para POS / movimientos. Replica el patrón de
 * `useRealtimeOrders` pero para las tablas de cash:
 *  - sales: alta/cancelación de ventas → list, day-balance.
 *  - order_payments: abonos a OS → balance/payments del row tocado.
 *  - product_movements: stock cambia (entrada/salida/ajuste) → products list.
 *  - part_movements: piezas usadas en OS → parts + balance de la OS.
 *  - sale_returns: devoluciones → sale, balance, products.
 *
 * Filtra server-side por sucursal_id; cambiar de sucursal cierra el canal
 * y abre uno nuevo (el nombre del canal lo incluye).
 */
export function useRealtimeCash() {
  const qc = useQueryClient();
  const sucursalId = useMaybeSucursalId();

  useEffect(() => {
    if (!sucursalId) return;

    const filter = `sucursal_id=eq.${sucursalId}`;
    const channel = supabase
      .channel(`cash-sync-${sucursalId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales', filter },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as RowWithOrderId;
          invalidateSaleRelated(qc, sucursalId, { saleId: row.id });
          // Toast solo en INSERT (venta nueva en otra sesión). Updates son
          // típicamente cancelaciones — el cliente lo nota por la lista.
          if (payload.eventType === 'INSERT' && row.id) {
            toast('Nueva venta registrada en otra sesión', {
              id: `realtime-sale-${row.id}`,
              duration: 2000,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_payments', filter },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as RowWithOrderId;
          invalidateSaleRelated(qc, sucursalId, {
            saleId: row.sale_id ?? undefined,
            orderIds: row.order_id ? [row.order_id] : undefined,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_movements', filter },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as RowWithOrderId;
          invalidateProductRelated(qc, sucursalId, {
            productId: row.product_id ?? undefined,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'part_movements', filter },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as RowWithOrderId;
          invalidatePartRelated(qc, sucursalId, {
            orderId: row.order_id ?? undefined,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_returns', filter },
        (payload) => {
          const row = (payload.new ?? payload.old ?? {}) as RowWithOrderId;
          invalidateSaleRelated(qc, sucursalId, {
            saleId: row.sale_id ?? undefined,
          });
          // Devolución reintegra stock — invalidar productos.
          invalidateProductRelated(qc, sucursalId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, sucursalId]);
}
