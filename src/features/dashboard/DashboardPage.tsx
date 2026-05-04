import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Users,
  Wrench,
} from 'lucide-react';
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
import { useAuth } from '@/features/auth/AuthProvider';
import { useOverdueOrdersCount } from '@/features/orders/hooks';
import {
  useDashboardRevenue7d,
  type DashboardRevenuePoint,
} from './hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { currency } from '@/lib/format';

export default function DashboardPage() {
  const { profile } = useAuth();
  const revenue = useDashboardRevenue7d();
  const overdueCount = useOverdueOrdersCount();

  const fullName = profile?.full_name ?? profile?.email ?? '';
  const firstName = fullName.split(' ')[0] || fullName;
  const now = new Date();
  const dayLabel = capitalize(format(now, 'EEEE', { locale: es }));
  const longDate = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dayLabel}, {longDate}
          </p>
        </div>
        <Button asChild>
          <Link to="/reparaciones/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueCard
          data={revenue.data ?? []}
          loading={revenue.isLoading}
        />

        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Atajos a los módulos del taller</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/reparaciones">
                <Wrench className="mr-2 h-4 w-4" />
                Reparaciones
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/clientes">
                <Users className="mr-2 h-4 w-4" />
                Clientes
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/encargos">
                <Package className="mr-2 h-4 w-4" />
                Encargos
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/accesorios">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Accesorios
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/agenda">
                <CalendarDays className="mr-2 h-4 w-4" />
                Agenda
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/contabilidad">
                <Receipt className="mr-2 h-4 w-4" />
                Contabilidad
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/retrasados">
                <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                Retrasados
                {(overdueCount.data ?? 0) > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {overdueCount.data}
                  </Badge>
                )}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RevenueCard({
  data,
  loading,
}: {
  data: DashboardRevenuePoint[];
  loading: boolean;
}) {
  const total = data.reduce((sum, p) => sum + p.ingresos_total, 0);
  const today = data[data.length - 1]?.ingresos_total ?? 0;

  const rows = data.map((p) => ({
    label: format(parseISO(p.dia), 'EEE', { locale: es }),
    fullLabel: format(parseISO(p.dia), "d 'de' MMMM", { locale: es }),
    ingresos: p.ingresos_total,
  }));

  return (
    <Card className="lg:col-span-2">
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
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : total === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            Sin ingresos registrados en los últimos 7 días.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={rows}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
