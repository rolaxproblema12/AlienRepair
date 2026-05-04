import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  ArrowRight,
  Lock,
  Plus,
  Receipt,
  Wallet,
} from 'lucide-react';
import { useCurrentSession, useDayBalance, useSales } from './hooks';
import { PAYMENT_METHOD_ACCENT, PAYMENT_METHOD_LABELS } from './types';
import CashOpenDialog from './CashOpenDialog';
import CashCloseDialog from './CashCloseDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { currency } from '@/lib/format';
import { formatDateTime, formatRelativeShort } from '@/lib/dates';
import { cn } from '@/lib/utils';

export default function CashRegisterPage() {
  const sessionQ = useCurrentSession();
  const balanceQ = useDayBalance(sessionQ.data ?? undefined);
  const salesQ = useSales({});
  const [closeOpen, setCloseOpen] = useState(false);

  if (sessionQ.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const session = sessionQ.data;
  if (!session) return <CashOpenDialog />;

  const balance = balanceQ.data;
  const todaySales = (salesQ.data ?? []).filter((s) => s.cash_session_id === session.id);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Caja</h1>
          <p className="text-sm text-muted-foreground">
            Sesión abierta {formatRelativeShort(session.opened_at)} · Inicial{' '}
            {currency(session.opening_amount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/caja/venta/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva venta
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/caja/historial">
              <Receipt className="mr-2 h-4 w-4" />
              Historial
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setCloseOpen(true)}>
            <Lock className="mr-2 h-4 w-4" />
            Cerrar caja
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="VENTAS DEL DÍA" value={currency(balance?.totalSales ?? 0)} accent="bg-primary" />
        <KpiCard
          label="EFECTIVO ESPERADO"
          value={currency(balance?.cashExpected ?? 0)}
          accent="bg-emerald-500"
          hint={`Inicial ${currency(session.opening_amount)} + ventas efectivo`}
        />
        <KpiCard
          label="TARJETA + TRANSF."
          value={currency(
            (balance?.byMethod.tarjeta ?? 0) + (balance?.byMethod.transferencia ?? 0),
          )}
          accent="bg-violet-500"
        />
        <KpiCard
          label="VENTAS"
          value={String(balance?.salesCount ?? 0)}
          accent="bg-cyan-500"
          hint={
            balance?.cancelledTotal
              ? `Canceladas: ${currency(balance.cancelledTotal)}`
              : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desglose por método</CardTitle>
          <CardDescription>Solo ventas completadas de la sesión actual.</CardDescription>
        </CardHeader>
        <CardContent>
          {balanceQ.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => (
                <div
                  key={m}
                  className="rounded-md border border-border bg-muted/30 p-3"
                >
                  <span
                    className={cn(
                      'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      PAYMENT_METHOD_ACCENT[m],
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[m]}
                  </span>
                  <p className="mt-2 text-2xl font-bold tracking-tight">
                    {currency(balance?.byMethod[m] ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Ventas de hoy</CardTitle>
            <CardDescription>Ordenadas por más recientes.</CardDescription>
          </div>
          <Button variant="link" asChild className="h-auto p-0 text-primary">
            <Link to="/caja/historial">
              Ver todas
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {salesQ.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : todaySales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8" />
              <p className="text-sm">Aún no hay ventas registradas en esta sesión.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Folio</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="pr-6 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todaySales.slice(0, 10).map((s) => (
                  <TableRow
                    key={s.id}
                    className={s.status === 'cancelada' ? 'opacity-50 line-through' : ''}
                  >
                    <TableCell className="pl-6">
                      <Link
                        to={`/caja/${s.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        VTA-{s.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.customer?.name ?? 'Cliente general'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          PAYMENT_METHOD_ACCENT[s.payment_method],
                        )}
                      >
                        {PAYMENT_METHOD_LABELS[s.payment_method]}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm font-medium">
                      {currency(s.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CashCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        session={session}
        balance={balance}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span className={cn('absolute left-0 top-0 h-full w-1', accent)} />
      <CardContent className="pl-6 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
