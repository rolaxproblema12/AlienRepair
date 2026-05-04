import { useMemo, useState } from 'react';
import { BarChart3, Coins, Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import { useAccountingDaily } from './hooks';
import { useDebouncedValue } from '@/lib/hooks';
import KpiCard from '@/components/accounting/KpiCard';
import RevenueChart from '@/components/accounting/RevenueChart';
import KindBreakdown from '@/components/accounting/KindBreakdown';
import InventoryUtilityCard from '@/features/inventory/InventoryUtilityCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { firstOfMonthIso, isoDaysAgo, todayIso } from '@/lib/dates';
import { currency } from '@/lib/format';

type Preset = '7' | '30' | 'mtd' | 'custom';

export default function AccountingPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState(isoDaysAgo(30));
  const [customTo, setCustomTo] = useState(todayIso());
  const debouncedFrom = useDebouncedValue(customFrom, 400);
  const debouncedTo = useDebouncedValue(customTo, 400);

  const { from, to } = useMemo(() => {
    if (preset === '7') return { from: isoDaysAgo(6), to: todayIso() };
    if (preset === '30') return { from: isoDaysAgo(29), to: todayIso() };
    if (preset === 'mtd') return { from: firstOfMonthIso(), to: todayIso() };
    return { from: debouncedFrom, to: debouncedTo };
  }, [preset, debouncedFrom, debouncedTo]);

  const { data, isLoading } = useAccountingDaily(from, to);

  const totals = useMemo(() => {
    const rows = data ?? [];
    const today = todayIso();
    const firstMonth = firstOfMonthIso();
    const acc = {
      ingresos: 0,
      gastos: 0,
      ganancia: 0,
      ingresosHoy: 0,
      ingresosMes: 0,
    };
    for (const r of rows) {
      const ing = Number(r.ingresos_total);
      const gas = Number(r.gastos_total);
      acc.ingresos += ing;
      acc.gastos += gas;
      acc.ganancia += Number(r.ganancia);
      if (r.dia === today) acc.ingresosHoy += ing;
      if (r.dia >= firstMonth && r.dia <= today) acc.ingresosMes += ing;
    }
    return acc;
  }, [data]);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contabilidad</h1>
        <p className="text-muted-foreground">
          Ingresos, gastos y ganancia. Los ingresos consideran órdenes entregadas.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {(
            [
              { k: '7', label: '7 días' },
              { k: '30', label: '30 días' },
              { k: 'mtd', label: 'Este mes' },
              { k: 'custom', label: 'Personalizado' },
            ] as const
          ).map((p) => (
            <Button
              key={p.k}
              variant={preset === p.k ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreset(p.k)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Ingresos hoy"
              value={currency(totals.ingresosHoy)}
              icon={Coins}
            />
            <KpiCard
              label="Ingresos mes"
              value={currency(totals.ingresosMes)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Gastos (rango)"
              value={currency(totals.gastos)}
              icon={Receipt}
              tone="negative"
            />
            <KpiCard
              label="Ganancia (rango)"
              value={currency(totals.ganancia)}
              icon={BarChart3}
              tone={totals.ganancia >= 0 ? 'positive' : 'negative'}
              hint={`Ingresos ${currency(totals.ingresos)} − Gastos ${currency(totals.gastos)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ingresos vs Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                {data && data.length > 0 ? (
                  <RevenueChart data={data} />
                ) : (
                  <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-8 w-8" />
                    <p className="text-sm">Sin movimientos en el rango.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <KindBreakdown data={data ?? []} />
          </div>

          <InventoryUtilityCard from={from} to={to} />
        </>
      )}
    </div>
  );
}
