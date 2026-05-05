import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useEmployeeSalesReport } from '../hooks';
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
import { currentYearMonth } from './shared';

export default function EmployeeSalesPanel() {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const q = useEmployeeSalesReport({ yearMonth });
  const rows = useMemo(() => q.data ?? [], [q.data]);

  const totals = useMemo(() => {
    let ingresos = 0;
    let comision = 0;
    let ventas = 0;
    for (const r of rows) {
      ingresos += Number(r.ingresos_total);
      comision += Number(r.commission_amount);
      ventas += Number(r.ventas_count);
    }
    return { ingresos, comision, ventas };
  }, [rows]);

  function handleExport() {
    const csv = generateCsvContent(rows, [
      { key: 'employee_email', label: 'Email' },
      { key: 'employee_name', label: 'Nombre' },
      { key: 'ventas_count', label: 'Ventas' },
      { key: 'ingresos_total', label: 'Ingresos' },
      { key: 'commission_rate', label: 'Tasa comisión' },
      { key: 'commission_amount', label: 'Comisión' },
    ]);
    downloadCsv(`comisiones-${yearMonth}`, csv);
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
            <Button onClick={handleExport} disabled={!rows.length} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Ingresos del mes" value={currency(totals.ingresos)} />
        <Kpi label="Ventas registradas" value={String(totals.ventas)} />
        <Kpi label="Comisiones a pagar" value={currency(totals.comision)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas por empleado</CardTitle>
          <p className="text-xs text-muted-foreground">
            La tasa de comisión se configura en{' '}
            <strong>/admin/usuarios</strong> por usuario. Cambios afectan
            cálculos futuros (ventas viejas mantienen la tasa al momento del
            cálculo de la vista — refrescar el reporte si actualizas tasas).
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {q.isLoading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Cargando…</p>
          ) : !rows.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              Sin ventas registradas en este mes (o ningún empleado tiene
              created_by en sus ventas).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Empleado</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead className="pr-6 text-right">Comisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.employee_id}>
                    <TableCell className="pl-6">
                      <div className="text-sm font-medium">
                        {r.employee_name ?? r.employee_email ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.employee_email}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{r.ventas_count}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {currency(r.ingresos_total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {(Number(r.commission_rate) * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm font-semibold text-emerald-400">
                      {currency(r.commission_amount)}
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
