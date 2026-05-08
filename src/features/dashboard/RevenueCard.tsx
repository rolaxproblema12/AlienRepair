import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useDashboardRevenue7d } from './hooks';
import { currency } from '@/lib/format';

/**
 * Chart de ingresos últimos 7 días. Extraído del DashboardPage original a
 * archivo propio para que el page sólo orqueste y no contenga la lógica
 * de Recharts directamente. Funcionalmente igual al original.
 */
export default function RevenueCard() {
  const revenue = useDashboardRevenue7d();
  const data = revenue.data ?? [];
  const total = data.reduce((sum, p) => sum + p.ingresos_total, 0);
  const today = data[data.length - 1]?.ingresos_total ?? 0;

  // React Compiler memoiza este map automáticamente — manual useMemo
  // dispara react-hooks/preserve-manual-memoization.
  const rows = data.map((p) => ({
    label: format(parseISO(p.dia), 'EEE', { locale: es }),
    fullLabel: format(parseISO(p.dia), "d 'de' MMMM", { locale: es }),
    ingresos: p.ingresos_total,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Ingresos · últimos 7 días</CardTitle>
          <CardDescription>
            Total {currency(total)} · hoy {currency(today)}
          </CardDescription>
        </div>
        <Button variant="link" asChild className="h-auto p-0 text-primary">
          <Link to="/contabilidad">
            Ver contabilidad
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {revenue.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : total === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Sin ingresos registrados en los últimos 7 días.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dash-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(173 80% 40%)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(173 80% 40%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(0 0% 65%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(0 0% 65%)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(0 0% 10%)',
                    border: '1px solid hsl(0 0% 20%)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.fullLabel ?? ''
                  }
                  formatter={(v: number) => [currency(v), 'Ingresos']}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="hsl(173 80% 40%)"
                  fill="url(#dash-rev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
