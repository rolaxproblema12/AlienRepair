import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useMonthlyAccounting } from '../hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
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
import { generateCsvContent, downloadCsv } from '@/lib/csv';
import { printDocument } from '@/lib/printing';
import { currentYearMonth } from './shared';

export default function MonthlyAccountingPanel() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const { current: sucursal } = useCurrentSucursal();
  const q = useMonthlyAccounting({ yearMonth });
  // Estabilizar la referencia: q.data ?? [] crea un array nuevo cada render.
  const rows = useMemo(() => q.data ?? [], [q.data]);

  const totals = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    let ganancia = 0;
    for (const r of rows) {
      ingresos += Number(r.ingresos_total);
      gastos += Number(r.gastos_total);
      ganancia += Number(r.ganancia);
    }
    const margen = ingresos > 0 ? (ganancia / ingresos) * 100 : 0;
    return { ingresos, gastos, ganancia, margen };
  }, [rows]);

  function handleExportCsv() {
    const csv = generateCsvContent(rows, [
      { key: 'dia', label: 'Día' },
      { key: 'ingresos_reparacion', label: 'Reparación' },
      { key: 'ingresos_encargo', label: 'Encargo' },
      { key: 'ingresos_accesorio', label: 'Accesorio' },
      { key: 'ingresos_total', label: 'Ingresos totales' },
      { key: 'gastos_refaccion', label: 'Refacción' },
      { key: 'gastos_general', label: 'General' },
      { key: 'gastos_piezas', label: 'Piezas' },
      { key: 'gastos_total', label: 'Gastos totales' },
      { key: 'ganancia', label: 'Ganancia' },
    ]);
    downloadCsv(`contable-${yearMonth}`, csv);
  }

  async function handleExportPdf() {
    if (!sucursal) return;
    // El id codifica params: yearMonth + sucursalId. PrintReportPage los lee
    // del URL params y arma el reporte. printDocument abre una hidden window
    // y dispara webContents.print() — el user elige "Microsoft Print to PDF".
    try {
      await printDocument(
        'report',
        `monthly-${yearMonth}-${sucursal.id}`,
        'carta',
      );
    } catch (err) {
      console.error('print error', err);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="month">Mes</Label>
            <Input
              id="month"
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleExportCsv} disabled={!rows.length} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExportPdf} disabled={!rows.length || !sucursal} className="w-full">
              <Printer className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Ingresos" value={currency(totals.ingresos)} />
        <Kpi label="Gastos" value={currency(totals.gastos)} />
        <Kpi
          label="Ganancia"
          value={currency(totals.ganancia)}
          tone={totals.ganancia >= 0 ? 'pos' : 'neg'}
        />
        <Kpi label="Margen" value={`${totals.margen.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalle diario</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {q.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !rows.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Sin movimientos contables en este mes (sin órdenes entregadas ni
              gastos).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Día</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Refacción</TableHead>
                  <TableHead className="text-right">General</TableHead>
                  <TableHead className="text-right">Piezas</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="pr-6 text-right">Ganancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.dia}>
                    <TableCell className="pl-6 font-mono text-xs">{r.dia}</TableCell>
                    <TableCell className="text-right text-sm">{currency(r.ingresos_total)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{currency(r.gastos_refaccion)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{currency(r.gastos_general)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{currency(r.gastos_piezas)}</TableCell>
                    <TableCell className="text-right text-sm">{currency(r.gastos_total)}</TableCell>
                    <TableCell
                      className={`pr-6 text-right text-sm font-semibold ${Number(r.ganancia) < 0 ? 'text-destructive' : 'text-emerald-400'}`}
                    >
                      {currency(r.ganancia)}
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

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
}) {
  const colorClass =
    tone === 'pos'
      ? 'text-emerald-400'
      : tone === 'neg'
        ? 'text-destructive'
        : '';
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
