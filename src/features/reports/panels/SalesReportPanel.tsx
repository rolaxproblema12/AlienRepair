import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useSalesReport } from '../hooks';
import { PAYMENT_METHOD_LABELS, type SalePaymentMethod } from '@/features/cash/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { todayIso, daysAgoIso } from './shared';

export default function SalesReportPanel() {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod | 'all'>('all');

  const q = useSalesReport({ from, to, paymentMethod });
  // Estabilizar la referencia: q.data ?? [] crea un array nuevo cada render
  // y rompe la deps del useMemo de abajo.
  const rows = useMemo(() => q.data ?? [], [q.data]);

  // KPI agregados.
  const totals = useMemo(() => {
    let ingresos = 0;
    let ventas = 0;
    for (const r of rows) {
      ingresos += Number(r.ingresos);
      ventas += Number(r.ventas);
    }
    return { ingresos, ventas };
  }, [rows]);

  function handleExport() {
    const csv = generateCsvContent(rows, [
      { key: 'dia', label: 'Día' },
      { key: 'payment_method', label: 'Método' },
      { key: 'kind', label: 'Tipo' },
      { key: 'ventas', label: 'Ventas' },
      { key: 'ingresos', label: 'Ingresos' },
    ]);
    downloadCsv(`ventas-${from}-${to}`, csv);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Método de pago</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExport} disabled={!rows.length} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi label="Ingresos en el rango" value={currency(totals.ingresos)} />
        <Kpi label="Ventas registradas" value={String(totals.ventas)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por día / método / tipo</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {q.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !rows.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Sin ventas en el rango seleccionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Día</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="pr-6 text-right">Ingresos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.dia}-${r.payment_method}-${r.kind}-${i}`}>
                    <TableCell className="pl-6 font-mono text-xs">{r.dia}</TableCell>
                    <TableCell className="text-xs">
                      {PAYMENT_METHOD_LABELS[r.payment_method]}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.kind}</TableCell>
                    <TableCell className="text-right text-sm">{r.ventas}</TableCell>
                    <TableCell className="pr-6 text-right text-sm font-medium">
                      {currency(r.ingresos)}
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
