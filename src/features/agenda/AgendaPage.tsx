import { Link } from 'react-router-dom';
import { CalendarDays, MessageCircle } from 'lucide-react';
import {
  addDays,
  endOfWeek,
  isAfter,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns';
import { useAgendaOrders } from '@/features/orders/hooks';
import { KIND_LABELS, type OrderWithCustomer } from '@/features/orders/types';
import { routeFor } from '@/features/orders/utils';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { openWhatsApp, buildStatusMessage } from '@/lib/whatsapp';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useSucursalSettingsMap } from '@/features/admin/sucursalConfig/hooks';
import { formatShortDate, isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Group {
  key: string;
  label: string;
  orders: OrderWithCustomer[];
}

function groupOrders(orders: OrderWithCustomer[]): Group[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const overdue: OrderWithCustomer[] = [];
  const hoy: OrderWithCustomer[] = [];
  const manana: OrderWithCustomer[] = [];
  const semana: OrderWithCustomer[] = [];
  const proximas: OrderWithCustomer[] = [];
  const sinFecha: OrderWithCustomer[] = [];

  for (const o of orders) {
    if (!o.estimated_delivery) {
      sinFecha.push(o);
      continue;
    }
    const d = parseISO(o.estimated_delivery);
    const stillPending = !['listo', 'entregado'].includes(o.status);
    if (stillPending && isOverdue(o.estimated_delivery)) overdue.push(o);
    else if (isSameDay(d, today)) hoy.push(o);
    else if (isSameDay(d, tomorrow)) manana.push(o);
    else if (isWithinInterval(d, { start: tomorrow, end: weekEnd })) semana.push(o);
    else if (isAfter(d, weekEnd)) proximas.push(o);
  }

  return [
    { key: 'overdue', label: 'Retrasadas', orders: overdue },
    { key: 'hoy', label: 'Hoy', orders: hoy },
    { key: 'manana', label: 'Mañana', orders: manana },
    { key: 'semana', label: 'Esta semana', orders: semana },
    { key: 'proximas', label: 'Próximas', orders: proximas },
    { key: 'sinFecha', label: 'Sin fecha', orders: sinFecha },
  ].filter((g) => g.orders.length > 0);
}

export default function AgendaPage() {
  const { data, isLoading } = useAgendaOrders();
  const { current: sucursal } = useCurrentSucursal();
  const { map: settingsMap } = useSucursalSettingsMap(sucursal?.id);

  const groups = data ? groupOrders(data) : [];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">Entregas programadas por fecha.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10" />
            <p>No hay órdenes activas en la agenda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader>
                <CardTitle
                  className={cn(
                    'flex items-center justify-between',
                    g.key === 'overdue' && 'text-destructive'
                  )}
                >
                  <span>{g.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {g.orders.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {g.orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary/40"
                  >
                    <Link
                      to={routeFor(o.kind, o.id)}
                      className="flex flex-1 items-center gap-3"
                    >
                      <span className="font-mono text-sm font-medium">#{o.folio}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {o.customer?.name ?? 'Sin cliente'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {KIND_LABELS[o.kind]} ·{' '}
                          {o.kind === 'reparacion'
                            ? [o.brand, o.model].filter(Boolean).join(' ') || o.device_type
                            : o.item_description ?? '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'text-sm',
                            isOverdue(o.estimated_delivery) &&
                              !['listo', 'entregado'].includes(o.status) &&
                              'text-destructive'
                          )}
                        >
                          {formatShortDate(o.estimated_delivery)}
                        </p>
                        <OrderStatusBadge status={o.status} />
                      </div>
                    </Link>
                    {o.customer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="WhatsApp"
                        onClick={() => {
                          const c = o.customer;
                          if (!c) return;
                          openWhatsApp(
                            c.phone,
                            buildStatusMessage(c.name, o.folio, o.status, {
                              shopName: sucursal?.name,
                              template: settingsMap.get(`msg_status_${o.status}`),
                            }),
                          );
                        }}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
