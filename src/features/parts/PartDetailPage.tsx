import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Cpu, Eye, EyeOff, Pencil } from 'lucide-react';
import { usePart, usePartMovements } from './hooks';
import {
  MOVEMENT_KIND_ACCENT,
  MOVEMENT_KIND_LABELS,
  PART_CATEGORY_COLOR,
  PART_CATEGORY_LABELS,
  isPartLowStock,
  partMargin,
  partMarginPct,
} from './types';
import PartMovementDialog from './PartMovementDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { currency } from '@/lib/format';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useCanSeeCosts } from '@/lib/costVisibilityStore';

export default function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const partQ = usePart(id);
  const movementsQ = usePartMovements(id);
  const [moveOpen, setMoveOpen] = useState(false);
  const costs = useCanSeeCosts();

  if (partQ.isLoading || !partQ.data) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const p = partQ.data;
  const margin = partMargin(p);
  const pct = partMarginPct(p);
  const low = isPartLowStock(p);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/piezas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            {!p.active && (
              <Badge variant="muted" className="uppercase text-[10px]">
                Inactiva
              </Badge>
            )}
            {low && (
              <Badge variant="destructive" className="uppercase text-[10px]">
                Stock bajo
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {p.brand} · {p.model}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-white',
                PART_CATEGORY_COLOR[p.category],
              )}
            >
              {PART_CATEGORY_LABELS[p.category]}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {costs.isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={costs.toggle}
              title={costs.hidden ? 'Mostrar costos' : 'Ocultar costos'}
            >
              {costs.hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button onClick={() => setMoveOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Registrar movimiento
          </Button>
          <Button asChild variant="outline">
            <Link to={`/piezas/${p.id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          costs.canSee ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
        )}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stock actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                'text-3xl font-bold tracking-tight',
                low && 'text-destructive',
              )}
            >
              {p.stock}
            </p>
            {p.min_stock != null && (
              <p className="text-xs text-muted-foreground">Mínimo: {p.min_stock}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {costs.canSee ? 'Precios' : 'Precio'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {costs.canSee && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compra</span>
                <span className="font-medium">{currency(p.cost_purchase)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {costs.canSee ? 'Venta' : 'Recomendado'}
              </span>
              <span className="font-medium">{currency(p.cost_sale)}</span>
            </div>
          </CardContent>
        </Card>

        {costs.canSee && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Utilidad por pieza</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-3xl font-bold tracking-tight',
                  margin >= 0 ? 'text-emerald-400' : 'text-destructive',
                )}
              >
                {currency(margin)}
              </p>
              <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% de margen</p>
            </CardContent>
          </Card>
        )}
      </div>

      {p.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{p.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {movementsQ.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !movementsQ.data?.length ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <Cpu className="h-8 w-8" />
              <p className="text-sm">Sin movimientos registrados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="pr-6">Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsQ.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6 text-xs text-muted-foreground">
                      {formatDateTime(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          MOVEMENT_KIND_ACCENT[m.kind],
                        )}
                      >
                        {MOVEMENT_KIND_LABELS[m.kind]}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-sm',
                        m.quantity > 0
                          ? 'text-emerald-400'
                          : m.quantity < 0
                            ? 'text-red-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.reason ?? '—'}
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">
                      {m.reference ?? ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PartMovementDialog open={moveOpen} onOpenChange={setMoveOpen} part={p} />
    </div>
  );
}
