import { Trophy } from 'lucide-react';
import { useEmployeeSalesReport } from '@/features/reports/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { currency } from '@/lib/format';
import { format } from 'date-fns';

/**
 * Card admin: ventas por empleado en el mes en curso. Solo se renderiza si
 * hay 2+ empleados con ventas (un ranking de 1 no aporta).
 *
 * Reusa `useEmployeeSalesReport` con yearMonth = mes actual.
 */
export default function EmployeeSalesCard() {
  const yearMonth = format(new Date(), 'yyyy-MM');
  const report = useEmployeeSalesReport({ yearMonth });

  const employees = report.data ?? [];

  // Si solo hay 1 empleado o ninguno, no renderizamos la card. El parent
  // puede usar `EmployeeSalesCard.shouldShow(...)` o simplemente render
  // condicional con el length — usamos null para no ocupar la grilla.
  if (!report.isLoading && employees.length < 2) {
    return null;
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Ventas por empleado · mes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {report.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ol className="space-y-2">
            {employees.map((e, idx) => {
              const display = e.employee_name || e.employee_email || 'Sin nombre';
              const initial = display.charAt(0).toUpperCase();
              return (
                <li
                  key={e.employee_id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">
                      {idx === 0 && '🏆 '}
                      {display}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.ventas_count} ventas · comisión {currency(e.commission_amount)}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {currency(e.ingresos_total)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
