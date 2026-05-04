import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { todayIso } from '@/lib/dates';
import { useMaybeSucursalId } from '@/features/sucursales/useScopedSucursalId';

interface OrderRow {
  id?: string;
  customer_id?: string;
  status?: string;
  estimated_delivery?: string | null;
  kind?: string;
}

function isOverdueRow(row: OrderRow | null | undefined, today: string): boolean {
  if (!row) return false;
  if (!row.status || !row.estimated_delivery) return false;
  if (row.status === 'listo' || row.status === 'entregado') return false;
  return row.estimated_delivery < today;
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
          const today = todayIso();
          const newRow = (payload.new ?? null) as OrderRow | null;
          const oldRow = (payload.old ?? null) as OrderRow | null;
          const eventType = payload.eventType;

          qc.invalidateQueries({ queryKey: ['orders'] });
          qc.invalidateQueries({ queryKey: ['orders-agenda'] });

          // Saldo y pagos pueden cambiar al editar costo o status; invalidar
          // siempre los balances/pagos del row tocado.
          if (newRow?.id || oldRow?.id) {
            const orderId = newRow?.id ?? oldRow?.id;
            qc.invalidateQueries({ queryKey: ['order-balance', orderId] });
            qc.invalidateQueries({ queryKey: ['order-payments', orderId] });
          }

          // Si la orden pasó a/desde 'entregado', el reporte contable cambia.
          const statusChanged = oldRow?.status !== newRow?.status;
          const touchesAccounting =
            statusChanged &&
            (oldRow?.status === 'entregado' || newRow?.status === 'entregado');
          if (touchesAccounting || payload.eventType !== 'UPDATE') {
            qc.invalidateQueries({ queryKey: ['accounting'] });
          }

          const wasOverdue = isOverdueRow(oldRow, today);
          const isNowOverdue = isOverdueRow(newRow, today);
          const overdueChanged = wasOverdue !== isNowOverdue;

          if (eventType === 'INSERT') {
            if (newRow?.customer_id) {
              qc.invalidateQueries({ queryKey: ['customer-orders', newRow.customer_id] });
              qc.invalidateQueries({ queryKey: ['customer-active-orders', newRow.customer_id] });
            }
            if (isNowOverdue) {
              qc.invalidateQueries({ queryKey: ['orders-overdue'] });
              qc.invalidateQueries({ queryKey: ['orders-overdue-count'] });
            }
          } else if (eventType === 'DELETE') {
            if (oldRow?.id) qc.removeQueries({ queryKey: ['order', oldRow.id] });
            if (oldRow?.customer_id) {
              qc.invalidateQueries({ queryKey: ['customer-orders', oldRow.customer_id] });
              qc.invalidateQueries({ queryKey: ['customer-active-orders', oldRow.customer_id] });
            }
            if (wasOverdue) {
              qc.invalidateQueries({ queryKey: ['orders-overdue'] });
              qc.invalidateQueries({ queryKey: ['orders-overdue-count'] });
            }
          } else if (eventType === 'UPDATE') {
            if (newRow?.id) qc.invalidateQueries({ queryKey: ['order', newRow.id] });

            const oldCustomer = oldRow?.customer_id;
            const newCustomer = newRow?.customer_id;
            if (oldCustomer) {
              qc.invalidateQueries({ queryKey: ['customer-orders', oldCustomer] });
              qc.invalidateQueries({ queryKey: ['customer-active-orders', oldCustomer] });
            }
            if (newCustomer && newCustomer !== oldCustomer) {
              qc.invalidateQueries({ queryKey: ['customer-orders', newCustomer] });
              qc.invalidateQueries({ queryKey: ['customer-active-orders', newCustomer] });
            }
            if (overdueChanged) {
              qc.invalidateQueries({ queryKey: ['orders-overdue'] });
              qc.invalidateQueries({ queryKey: ['orders-overdue-count'] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, sucursalId]);
}
