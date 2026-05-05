import type { IntakeChecklistItemStatus, OrderWithCustomer } from '@/features/orders/types';
import {
  DEVICE_TYPE_LABELS,
  INTAKE_CHECKLIST_ITEMS,
  INTAKE_CHECKLIST_REASON_LABELS,
  INTAKE_CHECKLIST_STATUS_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
} from '@/features/orders/types';
import type { Sucursal } from '@/features/sucursales/types';
import PrintHeader from './PrintHeader';
import { formatDate, formatDateTime } from '@/lib/dates';
import { currency } from '@/lib/format';
import { formatPhoneDisplay } from '@/lib/whatsapp';

interface Props {
  order: OrderWithCustomer;
  variant: 'carta' | 'termica';
  sucursal?: Sucursal | null;
}

export default function ServiceOrderTemplate({ order, variant, sucursal }: Props) {
  const compact = variant === 'termica';
  const saldo = Number(order.cost) - Number(order.down_payment);

  const detail =
    order.kind === 'reparacion'
      ? [
          order.device_type && DEVICE_TYPE_LABELS[order.device_type],
          order.brand,
          order.model,
          order.color,
        ]
          .filter(Boolean)
          .join(' · ')
      : order.item_description ?? '—';

  return (
    <div className={compact ? 'print-termica' : 'print-carta'}>
      <PrintHeader
        title={`Orden de servicio — ${KIND_LABELS[order.kind]}`}
        folio={order.folio}
        compact={compact}
        sucursalName={sucursal?.name}
        sucursalAddress={sucursal?.address}
        sucursalPhone={sucursal?.phone}
      />

      <div className="print-section-title">Cliente</div>
      <div className="print-kv">
        <span>Nombre:</span>
        <span>{order.customer?.name ?? '—'}</span>
        <span>Teléfono:</span>
        <span>{order.customer ? formatPhoneDisplay(order.customer.phone) : '—'}</span>
      </div>

      <div className="print-section-title">
        {order.kind === 'reparacion' ? 'Equipo' : 'Artículo'}
      </div>
      <div className="print-kv">
        <span>Descripción:</span>
        <span>{detail}</span>
        {order.kind === 'reparacion' && order.problem && (
          <>
            <span>Falla reportada:</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{order.problem}</span>
          </>
        )}
        {order.kind !== 'reparacion' && order.item_description && !compact && (
          <>
            <span>Detalle:</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{order.item_description}</span>
          </>
        )}
      </div>

      {order.kind === 'reparacion' && order.diagnosis && (
        <>
          <div className="print-section-title">Diagnóstico</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{order.diagnosis}</p>
        </>
      )}

      <div className="print-section-title">Recepción</div>
      <div className="print-kv">
        <span>Ingresó:</span>
        <span>{formatDateTime(order.received_at)}</span>
        <span>Entrega estimada:</span>
        <span>{order.estimated_delivery ? formatDate(order.estimated_delivery) : '—'}</span>
        <span>Estatus:</span>
        <span>{STATUS_LABELS[order.status]}</span>
      </div>

      {order.kind === 'reparacion' && order.intake_checklist_applies !== null && (
        <>
          <div className="print-section-title">Estado del equipo al ingresar</div>
          {order.intake_checklist_applies === false ? (
            <div className="print-kv">
              <span>Checklist:</span>
              <span>
                No aplica
                {order.intake_checklist_reason
                  ? ` — ${INTAKE_CHECKLIST_REASON_LABELS[order.intake_checklist_reason]}`
                  : ''}
              </span>
              {order.intake_checklist_reason === 'otro' &&
                order.intake_checklist_reason_other && (
                  <>
                    <span>Detalle:</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>
                      {order.intake_checklist_reason_other}
                    </span>
                  </>
                )}
            </div>
          ) : (
            <table className="print-table">
              <tbody>
                <tr>
                  <td>Batería</td>
                  <td style={{ textAlign: 'right' }}>
                    {order.intake_checklist?.bateria_porcentaje !== null &&
                    order.intake_checklist?.bateria_porcentaje !== undefined
                      ? `${order.intake_checklist.bateria_porcentaje}%`
                      : '—'}
                  </td>
                </tr>
                <tr>
                  <td>Trae funda</td>
                  <td style={{ textAlign: 'right' }}>
                    {order.intake_checklist?.trae_funda ? 'Sí' : 'No'}
                  </td>
                </tr>
                {INTAKE_CHECKLIST_ITEMS.map((item) => {
                  const status = (order.intake_checklist?.[item.key] ??
                    'nc') as IntakeChecklistItemStatus;
                  return (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td style={{ textAlign: 'right' }}>
                        {INTAKE_CHECKLIST_STATUS_LABELS[status]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {order.warranty_void && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 8px',
            border: '2px solid #b00020',
            background: '#fff5f5',
            color: '#b00020',
            fontSize: compact ? '8.5pt' : '10pt',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          ESTE EQUIPO NO RECIBE GARANTÍA
          {order.warranty_void_reason
            ? ` — Razón: ${voidReasonLabel(order.warranty_void_reason)}`
            : ''}
        </div>
      )}

      <div className="print-section-title">Importes</div>
      <table className="print-table">
        <tbody>
          <tr>
            <td>Costo estimado</td>
            <td style={{ textAlign: 'right' }}>{currency(order.cost)}</td>
          </tr>
          <tr>
            <td>Anticipo</td>
            <td style={{ textAlign: 'right' }}>{currency(order.down_payment)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>Saldo</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>{currency(saldo)}</td>
          </tr>
        </tbody>
      </table>

      {order.notes && (
        <>
          <div className="print-section-title">Notas</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{order.notes}</p>
        </>
      )}

      {!compact && (
        <>
          <div className="print-terms">
            <strong>Términos del servicio</strong>
            <ol>
              <li>
                El costo es estimado. Si se detectan fallas adicionales se comunicará al
                cliente antes de proceder.
              </li>
              <li>
                Los equipos no reclamados después de 30 días pasarán a considerarse abandonados.
              </li>
              <li>
                Presentar esta orden para recoger el equipo. El anticipo no es reembolsable si se
                cancela el servicio una vez iniciado.
              </li>
            </ol>
          </div>

          <div className="print-signature">
            <div>Cliente</div>
            <div>Recibió / Técnico</div>
          </div>
        </>
      )}

      {compact && <hr className="print-hr" />}

      {sucursal?.warranty_message && (
        <div
          className="print-warranty"
          style={{
            marginTop: 8,
            padding: '6px 8px',
            border: '1px dashed #999',
            fontSize: compact ? '8pt' : '9.5pt',
            color: '#444',
            whiteSpace: 'pre-wrap',
          }}
        >
          {sucursal.warranty_message}
        </div>
      )}

      <div className="print-footer">
        {sucursal?.name ?? 'AlienTechnology'} · Gracias por su preferencia
      </div>
    </div>
  );
}

function voidReasonLabel(reason: string): string {
  switch (reason) {
    case 'mojado':
      return 'humedad / líquidos';
    case 'sin_codigo':
      return 'sin código de desbloqueo';
    case 'manual':
      return 'condición especial';
    default:
      return reason;
  }
}
