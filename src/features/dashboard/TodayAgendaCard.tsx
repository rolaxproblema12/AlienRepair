import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useAgendaOrders } from '@/features/orders/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS } from '@/features/orders/types';
import { todayIso } from '@/lib/dates';

const MAX_ITEMS = 5;

/**
 * Card "Hoy en agenda": OS con `estimated_delivery == today` (o anterior, si
 * vencidas y aún no entregadas). Compacta, lista de hasta 5 ítems con folio
 * + cliente + equipo + status badge.
 */
export default function TodayAgendaCard() {
  const agenda = useAgendaOrders();
  const today = todayIso();

  // Filtramos a las que están programadas para hoy o ya vencidas y no
  // entregadas — son las que el operador necesita ver hoy.
  const todayOrders =
    agenda.data?.filter(
      (o) => o.estimated_delivery && o.estimated_delivery <= today,
    ) ?? [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Hoy en agenda</CardTitle>
        </div>
        <Button variant="link" asChild className="h-auto p-0 text-xs">
          <Link to="/agenda">
            Ver todo
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {agenda.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : todayOrders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="h-8 w-8 opacity-50" />
            <p>Sin entregas programadas hoy.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayOrders.slice(0, MAX_ITEMS).map((o) => {
              const equipo =
                [o.brand, o.model].filter(Boolean).join(' ') ||
                o.item_description ||
                '—';
              return (
                <li key={o.id}>
                  <Link
                    to={`/reparaciones/${o.id}`}
                    className="flex items-start gap-2 rounded-md border border-border bg-card p-2 transition hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-primary">
                          #{o.folio}
                        </span>
                        <Badge variant="muted" className="text-[10px]">
                          {STATUS_LABELS[o.status]}
                        </Badge>
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-sm">
                        {o.customer?.name ?? '—'}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {equipo}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            {todayOrders.length > MAX_ITEMS && (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                +{todayOrders.length - MAX_ITEMS} más
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
