import type { OrderWithCustomer } from '@/features/orders/types';
import { KIND_LABELS } from '@/features/orders/types';
import type { Sucursal } from '@/features/sucursales/types';
import PrintHeader from './PrintHeader';
import { formatDateTime } from '@/lib/dates';
import { currency } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/whatsapp';

interface Props {
  order: OrderWithCustomer;
  variant: 'carta' | 'termica';
  sucursal?: Sucursal | null;
}

export default function ReceiptTemplate({ order, variant, sucursal }: Props) {
  const compact = variant === 'termica';
  const saldo = Number(order.cost) - Number(order.down_payment);
  const pagado = order.status === 'entregado';

  return (
    <div className={compact ? 'print-termica' : 'print-carta'}>
      <PrintHeader
        title={`Recibo — ${KIND_LABELS[order.kind]}`}
        folio={order.folio}
        compact={compact}
        sucursalName={sucursal?.name}
        sucursalAddress={sucursal?.address}
        sucursalPhone={sucursal?.phone}
      />

      <div className="print-kv">
        <span>Fecha:</span>
        <span>{formatDateTime(new Date())}</span>
        <span>Cliente:</span>
        <span>{order.customer?.name ?? '—'}</span>
        {order.customer && (
          <>
            <span>Teléfono:</span>
            <span>{formatPhoneDisplay(order.customer.phone)}</span>
          </>
        )}
      </div>

      <hr className="print-hr" />

      <table className="print-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th style={{ textAlign: 'right' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {order.kind === 'reparacion'
                ? [order.brand, order.model].filter(Boolean).join(' ') || 'Reparación'
                : order.item_description ?? KIND_LABELS[order.kind]}
            </td>
            <td style={{ textAlign: 'right' }}>{currency(order.cost)}</td>
          </tr>
          <tr>
            <td>Anticipo recibido</td>
            <td style={{ textAlign: 'right' }}>-{currency(order.down_payment)}</td>
          </tr>
        </tbody>
      </table>

      <hr className="print-hr" />

      <div className="print-total">
        {pagado ? 'Total pagado' : 'Saldo pendiente'}: {currency(pagado ? order.cost : saldo)}
      </div>

      {order.delivered_at && (
        <div style={{ marginTop: 8, fontSize: compact ? '9pt' : '10pt' }}>
          Entregado: {formatDateTime(order.delivered_at)}
        </div>
      )}

      {!compact && (
        <div className="print-signature">
          <div>Cliente</div>
          <div>Atendió</div>
        </div>
      )}

      {compact && <hr className="print-hr" />}

      <div className="print-footer">
        Gracias por su preferencia — {sucursal?.name ?? 'AlienTechnology'}
      </div>
    </div>
  );
}
