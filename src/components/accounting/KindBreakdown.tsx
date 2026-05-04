import type { AccountingDailyRow } from '@/features/accounting/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { currency } from '@/lib/format';

interface Props {
  data: AccountingDailyRow[];
}

export default function KindBreakdown({ data }: Props) {
  const totals = data.reduce(
    (acc, r) => ({
      reparacion: acc.reparacion + Number(r.ingresos_reparacion),
      encargo: acc.encargo + Number(r.ingresos_encargo),
      accesorio: acc.accesorio + Number(r.ingresos_accesorio),
    }),
    { reparacion: 0, encargo: 0, accesorio: 0 }
  );

  const grand = totals.reparacion + totals.encargo + totals.accesorio;
  const rows = [
    { key: 'reparacion', label: 'Reparaciones', value: totals.reparacion, color: 'bg-teal-500' },
    { key: 'encargo', label: 'Encargos', value: totals.encargo, color: 'bg-violet-500' },
    { key: 'accesorio', label: 'Accesorios', value: totals.accesorio, color: 'bg-amber-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos por tipo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const pct = grand > 0 ? (r.value / grand) * 100 : 0;
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{r.label}</span>
                <span className="font-medium">
                  {currency(r.value)}{' '}
                  <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full ${r.color}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
        {grand === 0 && (
          <p className="text-sm text-muted-foreground">Sin ingresos en este rango.</p>
        )}
      </CardContent>
    </Card>
  );
}
