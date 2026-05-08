import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { invalidateOrderRelated } from '@/lib/queryInvalidation';
import { useMaybeSucursalId } from '@/features/sucursales/useScopedSucursalId';

interface OrderRow {
  id?: string;
  customer_id?: string;
  status?: string;
  estimated_delivery?: string | null;
  kind?: string;
}

export function useRealtimeOrders() {
  const qc = useQueryClient();
  const sucursalId = useMaybeSucursalId();

  useEffect(() => {
    if (!sucursalId) return;
    // Filtramos del lado servidor por sucursal para no procesar eventos de
    // otras sucursales en el cliente. El nombre del canal incluye sucursalId
    // para que cambiar de sucursal cierre el canal viejo y abra uno nuevo.
    const channel = supabase
      .channel(`orders-sync-${sucursalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `sucursal_id=eq.${sucursalId}`,
        },
        (payload) => {
          const newRow = (payload.new ?? null) as OrderRow | null;
          const oldRow = (payload.old ?? null) as OrderRow | null;
          const eventType = payload.eventType;

          const orderId = newRow?.id ?? oldRow?.id;
          // Si la orden pasó a/desde 'entregado', el reporte contable cambia.
          const statusChanged = oldRow?.status !== newRow?.status;
          const accountingAffected =
            (statusChanged &&
              (oldRow?.status === 'entregado' || newRow?.status === 'entregado')) ||
            eventType !== 'UPDATE';

          invalidateOrderRelated(qc, sucursalId, {
            orderId,
            customerId: newRow?.customer_id,
            accountingAffected,
          });
          // Si el cliente cambió, también invalidar las queries del cliente
          // anterior — el helper se llama una segunda vez con ese customerId.
          if (
            oldRow?.customer_id &&
            oldRow.customer_id !== newRow?.customer_id
          ) {
            invalidateOrderRelated(qc, sucursalId, {
              customerId: oldRow.customer_id,
            });
          }

          if (eventType === 'DELETE' && oldRow?.id) {
            qc.removeQueries({ queryKey: ['order', sucursalId, oldRow.id] });
          }

          // Feedback visual cuando otra sesión cambia el status de una OS.
          // No disparamos en INSERT/DELETE para evitar spam y ruido visual
          // en operaciones masivas. La id evita duplicar el toast si el mismo
          // cambio se replica varias veces (Supabase a veces lo hace).
          if (eventType === 'UPDATE' && statusChanged) {
            // Duración corta + dedup por orderId. El operador del taller no
            // necesita ver detalle de qué status cambió; solo saber que la
            // data se sincronizó. 1.5s es suficiente para registrar
            // visualmente sin saturar si vienen 5 cambios en 5s.
            toast('Actualizado desde otra sesión', {
              id: `realtime-order-${orderId}`,
              duration: 1500,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, sucursalId]);
}
