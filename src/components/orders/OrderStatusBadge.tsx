import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/features/orders/types';
import { STATUS_LABELS } from '@/features/orders/types';

const VARIANT: Record<OrderStatus, 'muted' | 'secondary' | 'default' | 'success' | 'warning'> = {
  pendiente: 'muted',
  en_espera: 'warning',
  reparando: 'default',
  listo: 'success',
  entregado: 'secondary',
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
