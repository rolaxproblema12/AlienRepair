import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OrderWithCustomer } from '@/features/orders/types';

interface Props {
  order: OrderWithCustomer;
}

/**
 * Etiqueta chica que el operador pega físicamente en el equipo recibido.
 * Imprime en el mismo rollo térmico de 80mm con alto fijo (~40mm).
 *
 * Solo lleva info indispensable para identificar el equipo:
 *   - Folio grande (lo más visible).
 *   - Nombre del cliente.
 *   - Marca + modelo del equipo si están.
 *   - Fecha corta de recepción.
 *
 * Sin precio, sin descripción de problema — eso va en la orden carta.
 */
export default function OrderLabel({ order }: Props) {
  const brandModel = [order.brand, order.model].filter(Boolean).join(' ');
  const fecha = order.received_at
    ? format(parseISO(order.received_at), 'dd MMM', { locale: es })
    : '';

  return (
    <div className="print-label">
      <p className="folio">{order.folio}</p>
      <div className="meta">
        {order.customer?.name && <div>{order.customer.name}</div>}
        {brandModel && <div>{brandModel}</div>}
        {fecha && <div>{fecha}</div>}
      </div>
    </div>
  );
}
