import { useState } from 'react';
import { Download } from 'lucide-react';
import { useTopProductsReport } from '../hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { currency } from '@/lib/format';
import { formatDate } from '@/lib/dates';
import { generateCsvContent, downloadCsv } from '@/lib/csv';
import { todayIso, daysAgoIso } from './shared';

export default function TopProductsPanel() {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());

  const q = useTopProductsReport({ from, to, limit: 20 });
  const rows = q.data ?? [];

  function handleExport() {
    const csv = generateCsvContent(rows, [
      { key: 'name', label: 'Producto' },
      { key: 'sku', label: 'SKU' },
      { key: 'qty_total', label: 'Cantidad' },
      { key: 'revenue_total', label: 'Ingresos' },
      { key: 'last_sold_at', label: 'Última venta' },
    ]);
    downloadCsv(`top-productos-${from}-${to}`, csv);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} disabled={!rows.length} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 20 productos por ingresos</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordenados por revenue total. Solo cuenta ventas con al menos una
            unidad vendida en el rango.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {q.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !rows.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Sin ventas de productos en el rango.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="pr-6">Última venta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.product_id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sku ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.qty_total}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {currency(r.revenue_total)}
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">
                      {formatDate(r.last_sold_at)}
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
