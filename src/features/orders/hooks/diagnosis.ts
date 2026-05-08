import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateOrderRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { OrderStatus, OrderWithCustomer } from '../types';
import { LIST_COLUMNS } from './queries';

/**
 * Guarda el diagnóstico técnico de una OS de reparación.
 * Si el status actual es `pendiente`, lo cambia a `diagnostico` automáticamente.
 * En cualquier otro status, lo respeta (no se quiere regresar de `reparando`/`listo`).
 */
export function useSaveDiagnosis(orderId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { diagnosis: string; currentStatus: OrderStatus }) => {
      const { data: auth } = await supabase.auth.getUser();
      const newStatus: OrderStatus =
        input.currentStatus === 'pendiente' ? 'diagnostico' : input.currentStatus;
      const { data, error } = await supabase
        .from('orders')
        .update({
          diagnosis: input.diagnosis.trim(),
          status: newStatus,
          updated_by: auth.user?.id,
        })
        .eq('id', orderId)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as OrderWithCustomer;
    },
    onSettled: (data) => {
      invalidateOrderRelated(qc, sucursalId, {
        orderId,
        customerId: data?.customer_id,
      });
    },
  });
}
