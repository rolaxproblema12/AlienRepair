import { Link } from 'react-router-dom';
import { ArrowRight, Wallet } from 'lucide-react';
import { useCurrentSession, useDayBalance } from '@/features/cash/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, type SalePaymentMethod } from '@/features/cash/types';
import { cn } from '@/lib/utils';

const METHOD_ORDER: SalePaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia'];

/**
 * Card "Caja del día — detalle": muestra estado de la sesión actual con
 * breakdown por método de pago. Si no hay sesión abierta, CTA para abrir.
 */
export default function CashTodayCard() {
  const session = useCurrentSession();
  const balance = useDayBalance(session.data ?? null);

  const isLoading = session.isLoading || (session.data && balance.isLoading);
  const sessionOpen = !!session.data;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Caja del día</CardTitle>
          {sessionOpen ? (
            <Badge variant="success" className="text-[10px]">
              Abierta
            </Badge>
          ) : (
            <Badge variant="muted" className="text-[10px]">
              Cerrada
            </Badge>
          )}
        </div>
        <Button variant="link" asChild className="h-auto p-0 text-xs">
          <Link to="/caja">
            Ir a caja
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : !sessionOpen ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sin sesión de caja abierta.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/caja">Abrir caja</Link>
            </Button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Total ingresos</p>
              <p className="text-2xl font-semibold tabular-nums">
                {currency(balance.data?.totalSales ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {balance.data?.salesCount ?? 0}{' '}
                {(balance.data?.salesCount ?? 0) === 1 ? 'venta' : 'ventas'} ·{' '}
                Apertura {currency(session.data?.opening_amount ?? 0)}
              </p>
            </div>

            <div className="space-y-1.5">
              {METHOD_ORDER.map((m) => {
                const amount = balance.data?.byMethod[m] ?? 0;
                const total = balance.data?.totalSales ?? 0;
                const pct = total > 0 ? (amount / total) * 100 : 0;
                return (
                  <div key={m} className="space-y-0.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[m]}
                      </span>
                      <span className="font-mono tabular-nums">{currency(amount)}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          m === 'efectivo' && 'bg-emerald-500',
                          m === 'tarjeta' && 'bg-sky-500',
                          m === 'transferencia' && 'bg-violet-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {(balance.data?.cancelledTotal ?? 0) > 0 && (
              <p className="text-xs text-destructive">
                {currency(balance.data?.cancelledTotal ?? 0)} canceladas
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
