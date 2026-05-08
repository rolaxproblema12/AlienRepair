import { useCallback } from 'react';
import { toast } from 'sonner';
import { useUpdateOrderStatus } from './hooks';
import { STATUS_LABELS } from './types';
import type { OrderStatus, OrderWithCustomer } from './types';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useSucursalSettingsMap } from '@/features/admin/sucursalConfig/hooks';
import { openWhatsApp, buildStatusMessage } from '@/lib/whatsapp';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

type OrderWithAutoCollected = OrderWithCustomer & { autoCollected?: number };

/**
 * Wrapper de useUpdateOrderStatus que después de un cambio exitoso de
 * estado dispara una notificación toast con acción "Enviar WhatsApp" (si
 * el cliente tiene teléfono Y la sucursal tiene template configurado para
 * el nuevo status). El operador clickea para enviar — no se manda
 * automático para evitar spam por click rápido en kanban drag-and-drop.
 *
 * El toggle `whatsapp_auto_notify` en sucursal_settings (key/value) puede
 * deshabilitarlo per-sucursal. Default: enabled.
 */
export function useUpdateOrderStatusWithNotify() {
  const update = useUpdateOrderStatus();
  const { current: sucursal } = useCurrentSucursal();
  const { map: settingsMap } = useSucursalSettingsMap(sucursal?.id);

  const autoNotify = settingsMap.get('whatsapp_auto_notify') !== '0';

  const mutateAsync = useCallback(
    async (vars: { id: string; status: OrderStatus }): Promise<OrderWithCustomer> => {
      const result = (await update.mutateAsync(vars)) as OrderWithAutoCollected;
      // Si la mutation cobró saldo automáticamente al entregar, dar feedback
      // inmediato al operador (toast separado del de WhatsApp para que se vea
      // claro lo que se registró en caja).
      if (result.autoCollected && result.autoCollected > 0) {
        toast.success(
          `Cobro de ${currency(result.autoCollected)} registrado en efectivo`,
          {
            description: 'Saldo de la OS cubierto al entregar.',
            duration: 5_000,
          },
        );
      }
      if (autoNotify) {
        notifyStatusChange(result, sucursal?.name, settingsMap);
      }
      return result;
    },
    [update, autoNotify, sucursal?.name, settingsMap],
  );

  return { ...update, mutateAsync };
}

function notifyStatusChange(
  order: OrderWithCustomer,
  shopName: string | undefined,
  settingsMap: Map<string, string>,
): void {
  if (!order.customer?.phone) return;
  const template = settingsMap.get(`msg_status_${order.status}`);

  // Sin template explícito Y sin un default conocido, no spameamos. El
  // mapeo default cubre los 5 statuses estándar (ver lib/whatsapp.ts).
  const message = buildStatusMessage(
    order.customer.name,
    order.folio,
    order.status,
    { shopName, template },
  );

  toast.success(`Estatus actualizado a "${STATUS_LABELS[order.status]}"`, {
    description: `Notificar a ${order.customer.name} por WhatsApp?`,
    duration: 8_000,
    action: {
      label: 'Enviar WhatsApp',
      onClick: () => {
        openWhatsApp(order.customer!.phone, message).catch((err) => {
          toast.error(`Error abriendo WhatsApp: ${getErrorMessage(err)}`);
        });
      },
    },
  });
}
