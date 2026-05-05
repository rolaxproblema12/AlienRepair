import { Download } from 'lucide-react';
import { useOrderStatusStats } from '../hooks';
import { STATUS_LABELS, type OrderStatus } from '@/features/orders/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { currency } from '@/lib/format';
import { generateCsvContent, downloadCsv } from '@/lib/csv';
import { todayIso } from './shared';

export default function OrderStatusPanel() {
  const q = useOrderStatusStats();
  const rows = q.data ?? [];

  function handleExport() {
    const csv = generateCsvContent(rows, [
      { key: 'status', label: 'Estado' },
      { key: 'ordenes', label: 'Órdenes' },
      { key: 'ticket_promedio', label: 'Ticket promedio' },
      { key: 'dias_promedio_en_sistema', label: 'Días promedio' },
    ]);
    downloadCsv(`os-por-estado-${todayIso()}`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExport} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de servicio por estado</CardTitle>
          <p className="text-xs text-muted-foreground">
            Snapshot actual. "Días promedio" mide tiempo desde la creación de
            la OS hasta hoy.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {q.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !rows.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Sin datos. Esta sucursal aún no tiene órdenes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Estado</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                  <TableHead className="text-right">Ticket promedio</TableHead>
                  <TableHead className="pr-6 text-right">Días promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.status}>
                    <TableCell className="pl-6 text-sm capitalize">
                      {STATUS_LABELS[r.status as OrderStatus] ?? r.status}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.ordenes}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {currency(r.ticket_promedio)}
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm">
                      {Number(r.dias_promedio_en_sistema).toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
