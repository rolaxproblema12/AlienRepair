import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import {
  STATUS_ACCENT,
  STATUS_KANBAN_LABELS,
  type OrderStatus,
  type OrderWithCustomer,
} from '@/features/orders/types';
import OrderKanbanCard from './OrderKanbanCard';

interface Props {
  status: OrderStatus;
  orders: OrderWithCustomer[];
  cardTo?: (o: OrderWithCustomer) => string | undefined;
  trailingFor?: (o: OrderWithCustomer) => React.ReactNode;
  /** Si se define, la columna empieza colapsada a este número y muestra "Ver N más". */
  limit?: number;
}

export default function OrderKanbanColumn({
  status,
  orders,
  cardTo,
  trailingFor,
  limit,
}: Props) {
  const drop = useDroppable({ id: status });
  const [expanded, setExpanded] = useState(false);

  // Si cambia el filtro/búsqueda y `limit` deja de aplicar, reseteamos.
  useEffect(() => {
    if (!limit) setExpanded(false);
  }, [limit]);

  const collapsed = !!limit && !expanded && orders.length > limit;
  const visible = collapsed ? orders.slice(0, limit) : orders;
  const hidden = orders.length - visible.length;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-3.5 w-1 rounded-sm', STATUS_ACCENT[status])} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {STATUS_KANBAN_LABELS[status]}
        </span>
        <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          {orders.length}
        </span>
      </div>
      <div
        ref={drop.setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition',
          drop.isOver && 'border-primary/40 bg-primary/5',
        )}
      >
        {visible.map((o) => (
          <OrderKanbanCard
            key={o.id}
            order={o}
            draggable
            to={cardTo?.(o)}
            trailing={trailingFor?.(o)}
          />
        ))}

        {orders.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-[11px] text-muted-foreground">
            —
          </div>
        )}

        {collapsed && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-2 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
            Ver {hidden} {hidden === 1 ? 'más' : 'más'}
          </button>
        )}

        {!!limit && expanded && orders.length > limit && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-2 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
            Mostrar menos
          </button>
        )}
      </div>
    </div>
  );
}
