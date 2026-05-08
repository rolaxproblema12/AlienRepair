import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateSaleWithStock } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { SalePayment, SaleReturn } from '../types';
// Importar del archivo hermano por path directo, NO desde el barrel,
// para evitar ciclos.
import { useCurrentSession } from './cashSession';

const SALE_PAYMENT_COLUMNS =
  'id, sale_id, sucursal_id, payment_method, amount, notes, created_at';

export function useSalePayments(saleId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['sale-payments', sucursalId, saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_payments')
        .select(SALE_PAYMENT_COLUMNS)
        .eq('sale_id', saleId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SalePayment[];
    },
  });
}

// =====================================================
// Devoluciones parciales (sale_returns)
// =====================================================

const SALE_RETURN_COLUMNS =
  'id, sale_id, sale_item_id, quantity_returned, refund_amount, reason, cash_session_id, sucursal_id, created_by, created_at';

export function useSaleReturns(saleId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['sale-returns', sucursalId, saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_returns')
        .select(SALE_RETURN_COLUMNS)
        .eq('sale_id', saleId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SaleReturn[];
    },
  });
}

interface ReturnInput {
  sale_id: string;
  sale_item_id: string;
  quantity_returned: number;
  refund_amount: number;
  reason: string | null;
  /** Para invalidar order-payments si era abono. */
  order_id?: string | null;
}

export function useReturnSaleItem() {
  const sucursalId = useScopedSucursalId();
  const session = useCurrentSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReturnInput) => {
      if (!session.data) {
        throw new Error('No hay sesión de caja abierta. Abre caja para registrar devoluciones.');
      }
      const { data, error } = await supabase
        .from('sale_returns')
        .insert({
          sale_id: input.sale_id,
          sale_item_id: input.sale_item_id,
          quantity_returned: input.quantity_returned,
          refund_amount: input.refund_amount,
          reason: input.reason,
          cash_session_id: session.data.id,
          sucursal_id: sucursalId,
        })
        .select(SALE_RETURN_COLUMNS)
        .single();
      if (error) throw error;
      return data as SaleReturn;
    },
    onSuccess: (_data, vars) => {
      // Devolución: invalida sale + sales list + day-balance + stock
      // (vuelve al inventario) + order-balance/payments si era abono.
      invalidateSaleWithStock(qc, sucursalId, {
        saleId: vars.sale_id,
        orderIds: vars.order_id ? [vars.order_id] : undefined,
      });
    },
  });
}
