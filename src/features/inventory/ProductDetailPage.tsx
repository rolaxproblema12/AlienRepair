import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  Package,
  Pencil,
} from 'lucide-react';
import { useProduct, useProductMovements } from './hooks';
import {
  MOVEMENT_KIND_ACCENT,
  MOVEMENT_KIND_LABELS,
  isLowStock,
  marginAmount,
  marginPct,
} from './types';
import MovementDialog from './MovementDialog';
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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productQ = useProduct(id);
  const movementsQ = useProductMovements(id);
  const [moveOpen, setMoveOpen] = useState(false);

  if (productQ.isLoading || !productQ.data) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const p = productQ.data;
  const margin = marginAmount(p);
  const pct = marginPct(p);
  const low = isLowStock(p);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/inventario">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
            {!p.active && (
              <Badge variant="muted" className="uppercase text-[10px]">
                Inactivo
              </Badge>
            )}
            {low && (
              <Badge variant="destructive" className="uppercase text-[10px]">
                Stock bajo
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono text-primary">{p.sku}</span>
            {p.barcode && <> · {p.barcode}</>}
            {p.category && <> · {p.category.name}</>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMoveOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Registrar movimiento
          </Button>
          <Button asChild variant="outline">
            <Link to={`/inventario/${p.id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
              <p className="text-xs text-muted-foreground">
                Mínimo: {p.min_stock}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Precios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo</span>
              <span className="font-medium">{currency(p.cost_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Venta</span>
              <span className="font-medium">{currency(p.sale_price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-medium">{(Number(p.iva_rate) * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Utilidad</CardTitle>
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
      </div>

      {(p.brand || p.model || p.supplier || p.description || p.notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            {p.brand && (
              <div>
                <p className="text-xs text-muted-foreground">Marca</p>
                <p>{p.brand}</p>
              </div>
            )}
            {p.model && (
              <div>
                <p className="text-xs text-muted-foreground">Modelo</p>
                <p>{p.model}</p>
              </div>
            )}
            {p.supplier && (
              <div>
                <p className="text-xs text-muted-foreground">Proveedor</p>
                <p>{p.supplier}</p>
              </div>
            )}
            {p.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="whitespace-pre-wrap">{p.description}</p>
              </div>
            )}
            {p.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Notas internas</p>
                <p className="whitespace-pre-wrap">{p.notes}</p>
              </div>
            )}
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
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !movementsQ.data?.length ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
              <Package className="h-8 w-8" />
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

      <MovementDialog open={moveOpen} onOpenChange={setMoveOpen} product={p} />
    </div>
  );
}
