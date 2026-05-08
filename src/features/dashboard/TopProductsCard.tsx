import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useTopProductsReport } from '@/features/reports/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { firstOfMonthIso, todayIso } from '@/lib/dates';

const TOP_LIMIT = 5;

/**
 * Card admin: top 5 productos vendidos del mes en curso por revenue total.
 * Reusa `useTopProductsReport` con rango = primer día del mes hasta hoy.
 */
export default function TopProductsCard() {
  const top = useTopProductsReport({
    from: firstOfMonthIso(),
    to: todayIso(),
    limit: TOP_LIMIT,
  });

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Top productos · mes</CardTitle>
        </div>
        <Button variant="link" asChild className="h-auto p-0 text-xs">
          <Link to="/reportes">
            Reportes
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {top.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (top.data?.length ?? 0) === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            Sin ventas registradas este mes.
          </div>
        ) : (
          <ol className="space-y-1.5">
            {top.data!.map((p, idx) => (
              <li
                key={p.product_id}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.qty_total} unidades
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {currency(p.revenue_total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
