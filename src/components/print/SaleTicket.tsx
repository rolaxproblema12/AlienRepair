import type { SaleDetail } from '@/features/cash/types';
import { PAYMENT_METHOD_LABELS } from '@/features/cash/types';
import type { Sucursal } from '@/features/sucursales/types';
import PrintHeader from './PrintHeader';
import { formatDateTime } from '@/lib/dates';
import { currency } from '@/lib/format';

interface Props {
  sale: SaleDetail;
  sucursal?: Sucursal | null;
}

export default function SaleTicket({ sale, sucursal }: Props) {
  return (
    <div className="print-termica">
      <PrintHeader
        title="Ticket de venta"
        folio={sale.folio}
        compact
        sucursalName={sucursal?.name}
        sucursalAddress={sucursal?.address}
        sucursalPhone={sucursal?.phone}
      />

      <div className="print-kv">
        <span>Fecha:</span>
        <span>{formatDateTime(sale.created_at)}</span>
        <span>Cliente:</span>
        <span>{sale.customer?.name ?? 'Cliente general'}</span>
      </div>

      <hr className="print-hr" />

      <table className="print-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th style={{ textAlign: 'right' }}>Cant.</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((it) => (
            <tr key={it.id}>
              <td>{it.description}</td>
              <td style={{ textAlign: 'right' }}>{it.quantity}</td>
              <td style={{ textAlign: 'right' }}>{currency(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="print-hr" />

      <div className="print-kv">
        <span>Subtotal:</span>
        <span style={{ textAlign: 'right' }}>{currency(sale.subtotal)}</span>
        <span>IVA:</span>
        <span style={{ textAlign: 'right' }}>{currency(sale.iva_total)}</span>
        {Number(sale.discount_total) > 0 && (
          <>
            <span>Descuentos:</span>
            <span style={{ textAlign: 'right' }}>−{currency(sale.discount_total)}</span>
          </>
        )}
        <span style={{ fontWeight: 700, fontSize: 14 }}>TOTAL:</span>
        <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
          {currency(sale.total)}
        </span>
      </div>

      <hr className="print-hr" />

      {/* Pagos: lista todos los métodos. Si la venta es legacy
          (pre-migración 0039) sin sale_payments, muestra el legacy
          payment_method como única línea. */}
      <div className="print-kv">
        {sale.payments && sale.payments.length > 0 ? (
          sale.payments.map((p) => (
            <span key={p.id} style={{ display: 'contents' }}>
              <span>{PAYMENT_METHOD_LABELS[p.payment_method]}:</span>
              <span style={{ textAlign: 'right' }}>{currency(p.amount)}</span>
            </span>
          ))
        ) : (
          <>
            <span>{PAYMENT_METHOD_LABELS[sale.payment_method]}:</span>
            <span style={{ textAlign: 'right' }}>{currency(sale.total)}</span>
          </>
        )}
      </div>

      {sale.notes && (
        <>
          <hr className="print-hr" />
          <p style={{ fontSize: 11 }}>{sale.notes}</p>
        </>
      )}

      {sucursal?.warranty_message && (
        <>
          <hr className="print-hr" />
          <p style={{ fontSize: 10, color: '#444', whiteSpace: 'pre-wrap' }}>
            {sucursal.warranty_message}
          </p>
        </>
      )}

      <hr className="print-hr" />
      <p style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>
        ¡Gracias por su compra!
      </p>
    </div>
  );
}
