import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDeleteOrder, useOrders } from '@/features/orders/hooks';
import { useUpdateOrderStatusWithNotify } from '@/features/orders/useUpdateOrderStatusWithNotify';
import { useDebouncedValue } from '@/lib/hooks';
import { isOverdue } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type {
  OrderKind,
  OrderStatus,
  OrderWithCustomer,
} from '@/features/orders/types';
import OrderKanbanColumn from '@/components/orders/OrderKanbanColumn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { openWhatsApp, buildStatusMessage } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  kind: Extract<OrderKind, 'encargo' | 'accesorio'>;
}

const COPY = {
  encargo: {
    title: 'Encargos',
    subtitleSingular: 'encargo registrado',
    subtitlePlural: 'encargos registrados',
    item: 'encargo',
    emptyIcon: Package,
    newTo: '/encargos/nuevo',
    route: '/encargos',
  },
  accesorio: {
    title: 'Accesorios',
    subtitleSingular: 'accesorio registrado',
    subtitlePlural: 'accesorios registrados',
    item: 'accesorio',
    emptyIcon: ShoppingBag,
    newTo: '/accesorios/nuevo',
    route: '/accesorios',
  },
} as const;

type View = 'all' | 'overdue';

const ITEM_KANBAN_STATUSES: OrderStatus[] = ['pendiente', 'entregado'];
const COLUMN_LIMIT = 10;

export default function ItemsListPage({ kind }: Props) {
  const copy = COPY[kind];
  const Icon = copy.emptyIcon;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [view, setView] = useState<View>('all');
  const isSearching = debouncedSearch.trim().length > 0;

  const { data, isLoading } = useOrders({
    kind,
    status: 'all',
    search: debouncedSearch,
  });

  const updateStatus = useUpdateOrderStatusWithNotify();

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
      diagnostico: [],
      en_espera: [],
      reparando: [],
      listo: [],
      entregado: [],
    };
    for (const o of filtered) grouped[o.status]?.push(o);
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
    if (!ITEM_KANBAN_STATUSES.includes(newStatus)) return;
    try {
      // El wrapper toastea "Estatus actualizado…" + acción WhatsApp.
      await updateStatus.mutateAsync({ id: orderId, status: newStatus });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const total = data?.length ?? 0;
  const cardTo = (o: OrderWithCustomer) => `${copy.route}/${o.id}`;
  const trailingFor = (o: OrderWithCustomer) => (
    <RowMenu order={o} item={copy.item} route={copy.route} />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 px-8 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? copy.subtitleSingular : copy.subtitlePlural} · arrastra
            para cambiar estado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${copy.item}, cliente, folio...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <ViewTabs value={view} onChange={setView} />
          <Button asChild>
            <Link to={copy.newTo}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo {copy.item}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid flex-1 gap-4 px-8 py-6 md:grid-cols-2">
          {ITEM_KANBAN_STATUSES.map((s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          <Icon className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Sin {copy.item}s para mostrar.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid flex-1 gap-4 px-8 py-6 md:grid-cols-2">
            {ITEM_KANBAN_STATUSES.map((status) => (
              <OrderKanbanColumn
                key={status}
                status={status}
                orders={byStatus[status]}
                cardTo={cardTo}
                trailingFor={trailingFor}
                limit={isSearching ? undefined : COLUMN_LIMIT}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function ViewTabs({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const items: { key: View; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'overdue', label: 'Retrasados' },
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

interface RowMenuProps {
  order: OrderWithCustomer;
  item: string;
  route: string;
}

function RowMenu({ order: o, item, route }: RowMenuProps) {
  const del = useDeleteOrder();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    try {
      await del.mutateAsync(o.id);
      toast.success(`#${o.folio} eliminado`);
      setConfirmOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Más acciones"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {o.customer && (
            <DropdownMenuItem
              onSelect={() => {
                const c = o.customer;
                if (!c) return;
                openWhatsApp(
                  c.phone,
                  buildStatusMessage(c.name, o.folio, o.status),
                );
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to={`${route}/${o.id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              Se eliminará el {item} <strong>#{o.folio}</strong>. Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />
              {del.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
