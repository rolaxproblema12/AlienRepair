import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useOrders, useUpdateOrderStatus } from '@/features/orders/hooks';
import { useDebouncedValue } from '@/lib/hooks';
import { isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  type OrderStatus,
  type OrderWithCustomer,
} from '@/features/orders/types';
import OrderKanbanColumn from '@/components/orders/OrderKanbanColumn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';

type View = 'all' | 'overdue';

const COLUMN_LIMIT = 10;

export default function OrdersListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [view, setView] = useState<View>('all');
  const isSearching = debouncedSearch.trim().length > 0;

  const { data, isLoading } = useOrders({
    kind: 'reparacion',
    status: 'all',
    search: debouncedSearch,
  });

  const updateStatus = useUpdateOrderStatus();

  const filtered = useMemo(() => {
    if (!data) return [];
    if (view === 'overdue') {
      return data.filter(
        (o) =>
          !['listo', 'entregado'].includes(o.status) && isOverdue(o.estimated_delivery),
      );
    }
    return data;
  }, [data, view]);

  const byStatus = useMemo(() => {
    const grouped: Record<OrderStatus, OrderWithCustomer[]> = {
      pendiente: [],
      en_espera: [],
      reparando: [],
      listo: [],
      entregado: [],
    };
    for (const o of filtered) grouped[o.status].push(o);
    return grouped;
  }, [filtered]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  async function handleDragEnd(e: DragEndEvent) {
    const newStatus = e.over?.id as OrderStatus | undefined;
    const orderId = e.active.id as string;
    const fromStatus = e.active.data.current?.status as OrderStatus | undefined;
    if (!newStatus || newStatus === fromStatus) return;
    try {
      await updateStatus.mutateAsync({ id: orderId, status: newStatus });
      toast.success(`Movido a ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const total = data?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 px-8 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reparaciones</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'orden' : 'órdenes'} · arrastra para cambiar estado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar orden, cliente, teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ViewTabs value={view} onChange={setView} />
          <Button asChild>
            <Link to="/reparaciones/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid flex-1 gap-4 px-8 py-6 md:grid-cols-2 lg:grid-cols-5">
          {ORDER_STATUSES.map((s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          <Wrench className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Sin órdenes para mostrar.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid flex-1 gap-4 overflow-x-auto px-8 py-6 md:grid-cols-2 lg:grid-cols-5">
            {ORDER_STATUSES.map((status) => (
              <OrderKanbanColumn
                key={status}
                status={status}
                orders={byStatus[status]}
                limit={isSearching ? undefined : COLUMN_LIMIT}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

interface ViewTabsProps {
  value: View;
  onChange: (v: View) => void;
}

function ViewTabs({ value, onChange }: ViewTabsProps) {
  const items: { key: View; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'overdue', label: 'Retrasadas' },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={cn(
            'rounded-sm px-3 py-1.5 text-xs font-medium transition',
            value === it.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

