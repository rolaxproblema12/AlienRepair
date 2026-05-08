import { useNavigate } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useOrderStatusStats } from '@/features/reports/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from '@/features/orders/types';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pendiente: 'bg-slate-500',
  diagnostico: 'bg-amber-500',
  en_espera: 'bg-orange-500',
  reparando: 'bg-sky-500',
  listo: 'bg-violet-500',
  entregado: 'bg-emerald-500',
};

/**
 * Card admin: distribución de OS por status con bar chart horizontal,
 * count + ticket promedio + días promedio. Click en una barra navega a
 * `/reparaciones?status=X`.
 *
 * Filtra a status activos (excluye 'entregado') porque el dashboard mide
 * trabajo pendiente, no histórico.
 */
export default function OrderStatusBreakdownCard() {
  const stats = useOrderStatusStats();
  const navigate = useNavigate();

  const activeStats = (stats.data ?? [])
    .filter((s) => ORDER_STATUSES.includes(s.status as OrderStatus) && s.status !== 'entregado')
    .map((s) => ({ ...s, status: s.status as OrderStatus }));

  const maxCount = Math.max(...activeStats.map((s) => s.ordenes), 1);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Distribución de OS</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {stats.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : activeStats.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Sin OS activas en el sistema.
          </div>
        ) : (
          <ul className="space-y-3">
            {activeStats.map((s) => {
              const widthPct = (s.ordenes / maxCount) * 100;
              return (
                <li key={s.status}>
                  <button
                    type="button"
                    onClick={() => navigate(`/reparaciones?status=${s.status}`)}
                    className="w-full text-left transition hover:opacity-80"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{STATUS_LABELS[s.status]}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {s.ordenes}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          STATUS_COLORS[s.status],
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between gap-4 text-[11px] text-muted-foreground">
                      <span>Ticket prom. {currency(s.ticket_promedio ?? 0)}</span>
                      <span>{Math.round(s.dias_promedio_en_sistema ?? 0)} días en sistema</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
