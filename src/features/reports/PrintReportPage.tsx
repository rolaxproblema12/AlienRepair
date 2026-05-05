import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMonthlyAccounting } from './hooks';
import { useSucursalConfig } from '@/features/admin/sucursalConfig/hooks';
import PrintHeader from '@/components/print/PrintHeader';
import { currency } from '@/lib/format';

/**
 * Página /print/report/:id renderizada en una hidden BrowserWindow por
 * `printDocument('report', id, 'carta')`. El id codifica el tipo + params
 * separados por '-':
 *   monthly-2026-05-<sucursalId>
 *
 * Por ahora solo soporta `monthly`. Si se agregan más reports tipo PDF,
 * extender el switch acá.
 */
export default function PrintReportPage() {
  const { id } = useParams<{ id: string }>();
  const parsed = useMemo(() => parseId(id ?? ''), [id]);

  if (!parsed || parsed.type !== 'monthly') {
    return <FallbackBody msg={`Tipo de reporte desconocido: ${id}`} />;
  }
  return (
    <MonthlyReport yearMonth={parsed.yearMonth} sucursalId={parsed.sucursalId} />
  );
}

function parseId(
  id: string,
): { type: 'monthly'; yearMonth: string; sucursalId: string } | null {
  // monthly-YYYY-MM-<uuid> → uuid es 36 chars con guiones, así que partimos
  // por la primera ocurrencia desde la derecha.
  const match = id.match(/^monthly-(\d{4}-\d{2})-([0-9a-f-]{36})$/i);
  if (!match) return null;
  return { type: 'monthly', yearMonth: match[1], sucursalId: match[2] };
}

function FallbackBody({ msg }: { msg: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      {msg}
      <p className="mt-2 text-xs">No se puede imprimir.</p>
    </div>
  );
}

function MonthlyReport({
  yearMonth,
  sucursalId,
}: {
  yearMonth: string;
  sucursalId: string;
}) {
  const sucursalQ = useSucursalConfig(sucursalId);
  const q = useMonthlyAccounting({ yearMonth });

  // Disparar notifyPrintReady cuando todo cargó. Mismo patrón que
  // PrintOrderPage: agregar body class + rAF para el handshake del main.
  useEffect(() => {
    if (q.data && sucursalQ.data) {
      document.body.classList.add('print-carta-page');
      requestAnimationFrame(() => {
        window.alien?.notifyPrintReady?.();
      });
    }
    return () => {
      document.body.classList.remove('print-carta-page');
    };
  }, [q.data, sucursalQ.data]);

  if (q.isLoading || sucursalQ.isLoading) {
    return <div className="p-8 text-center">Cargando reporte…</div>;
  }

  const sucursal = sucursalQ.data ?? null;
  const rows = q.data ?? [];

  const totals = rows.reduce(
    (acc, r) => {
      acc.ingresos += Number(r.ingresos_total);
      acc.gastos += Number(r.gastos_total);
      acc.ganancia += Number(r.ganancia);
      return acc;
    },
    { ingresos: 0, gastos: 0, ganancia: 0 },
  );

  return (
    <div className="print-root">
      <PrintHeader
        title={`Reporte contable mensual — ${yearMonth}`}
        folio={yearMonth}
        sucursalName={sucursal?.name}
        sucursalAddress={sucursal?.address}
        sucursalPhone={sucursal?.phone}
      />

      <div style={{ marginTop: 12, fontSize: '10pt' }}>
        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Día</th>
              <th style={thRight}>Ingresos</th>
              <th style={thRight}>Refacción</th>
              <th style={thRight}>General</th>
              <th style={thRight}>Piezas</th>
              <th style={thRight}>Gastos</th>
              <th style={thRight}>Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dia}>
                <td style={td}>{r.dia}</td>
                <td style={tdRight}>{currency(r.ingresos_total)}</td>
                <td style={tdRight}>{currency(r.gastos_refaccion)}</td>
                <td style={tdRight}>{currency(r.gastos_general)}</td>
                <td style={tdRight}>{currency(r.gastos_piezas)}</td>
                <td style={tdRight}>{currency(r.gastos_total)}</td>
                <td style={tdRight}>{currency(r.ganancia)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', padding: 16 }}>
                  Sin movimientos en el mes.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #000', fontWeight: 700 }}>
              <td style={td}>TOTAL</td>
              <td style={tdRight}>{currency(totals.ingresos)}</td>
              <td colSpan={3} style={tdRight}>—</td>
              <td style={tdRight}>{currency(totals.gastos)}</td>
              <td style={tdRight}>{currency(totals.ganancia)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {sucursal?.warranty_message && (
        <p style={{ marginTop: 24, fontSize: '8pt', color: '#444' }}>
          {sucursal.warranty_message}
        </p>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  borderBottom: '1px solid #999',
  fontSize: '9pt',
};
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = {
  padding: '3px 6px',
  borderBottom: '1px solid #eee',
  fontSize: '9pt',
};
const tdRight: React.CSSProperties = { ...td, textAlign: 'right' };
