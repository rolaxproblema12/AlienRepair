import { Link } from 'react-router-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeShort, isOverdue } from '@/lib/dates';
import { DEVICE_TYPE_LABELS, type OrderWithCustomer } from '@/features/orders/types';

interface Props {
  order: OrderWithCustomer;
  draggable?: boolean;
  to?: string;
  trailing?: React.ReactNode;
}

export default function OrderKanbanCard({ order: o, draggable, to, trailing }: Props) {
  const overdue =
    !['listo', 'entregado'].includes(o.status) && isOverdue(o.estimated_delivery);

  const titleLine =
    o.kind === 'reparacion'
      ? [o.brand, o.model].filter(Boolean).join(' ') ||
        (o.device_type ? DEVICE_TYPE_LABELS[o.device_type] : 'Reparación')
      : o.item_description ?? '—';

  const subtitle = o.kind === 'reparacion' ? o.problem : o.notes ?? o.item_description;

  const detailHref =
    to ??
    (o.kind === 'reparacion'
      ? `/reparaciones/${o.id}`
      : o.kind === 'encargo'
        ? `/encargos/${o.id}`
        : `/accesorios/${o.id}`);

  return (
    <KanbanCardShell id={o.id} status={o.status} draggable={!!draggable}>
      <div className="flex items-center justify-between gap-2">
        <Link
          to={detailHref}
          className="font-mono text-[11px] font-semibold tracking-wide text-primary hover:underline"
        >
          OS-{o.folio}
        </Link>
        <div className="flex items-center gap-2">
          {overdue && (
            <Badge
              variant="destructive"
              className="h-4 rounded-sm px-1.5 text-[9px] font-semibold tracking-wide"
            >
              URG
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeShort(o.created_at)}
          </span>
          {trailing}
        </div>
      </div>

      <Link to={detailHref} className="mt-2 block">
        <div className="text-sm font-medium text-foreground line-clamp-1">{titleLine}</div>
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{subtitle}</div>
        )}
      </Link>

      <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
        <Phone className="h-3 w-3" />
        <span className="truncate">{o.customer?.name ?? 'Sin cliente'}</span>
      </div>
    </KanbanCardShell>
  );
}

interface ShellProps {
  id: string;
  status: string;
  draggable: boolean;
  children: React.ReactNode;
}

function KanbanCardShell({ id, status, draggable, children }: ShellProps) {
  const drag = useDraggable({
    id,
    data: { status },
    disabled: !draggable,
  });

  const style = drag.transform
    ? { transform: CSS.Translate.toString(drag.transform) }
    : undefined;

  return (
    <div
      ref={drag.setNodeRef}
      style={style}
      {...(draggable ? drag.listeners : {})}
      {...(draggable ? drag.attributes : {})}
      className={cn(
        'group rounded-lg border border-border bg-card p-3 shadow-sm transition',
        'hover:border-primary/40 hover:shadow-md',
        draggable && 'cursor-grab active:cursor-grabbing',
        drag.isDragging && 'opacity-40',
      )}
    >
      {children}
    </div>
  );
}
