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

  // Truncar a 1 línea cada campo para no exceder los 40mm de alto fijo
  // del @page label. Si nombre o brand+modelo son largos, se cortan con
  // ellipsis en vez de desbordar y "comerse" la fecha o la siguiente
  // etiqueta del rollo.
  const truncate = {
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div className="print-label">
      <p className="folio" style={truncate}>{order.folio}</p>
      <div className="meta">
        {order.customer?.name && <div style={truncate}>{order.customer.name}</div>}
        {brandModel && <div style={truncate}>{brandModel}</div>}
        {fecha && <div style={truncate}>{fecha}</div>}
      </div>
    </div>
  );
}
