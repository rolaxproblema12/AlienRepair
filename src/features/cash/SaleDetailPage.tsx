import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Printer, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCancelSale, useSale, useSaleReturns } from './hooks';
import { PAYMENT_METHOD_ACCENT, PAYMENT_METHOD_LABELS } from './types';
import type { SaleItem } from './types';
import ReturnItemDialog from './ReturnItemDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { currency } from '@/lib/format';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { printDocument } from '@/lib/printing';
import { getErrorMessage } from '@/lib/errors';

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const saleQ = useSale(id);
  const returnsQ = useSaleReturns(id);
  const cancel = useCancelSale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [returnItem, setReturnItem] = useState<SaleItem | null>(null);

  if (saleQ.isLoading || !saleQ.data) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const s = saleQ.data;
  const isCancelled = s.status === 'cancelada';
  const isPartialReturn = s.status === 'parcialmente_devuelta';
  const returns = returnsQ.data ?? [];

  // Cuánto fue devuelto por sale_item_id, para mostrar restante y bloquear botón.
  const returnedByItem = new Map<string, number>();
  for (const r of returns) {
    returnedByItem.set(
      r.sale_item_id,
      (returnedByItem.get(r.sale_item_id) ?? 0) + Number(r.quantity_returned),
    );
  }

  async function handleCancel() {
    if (!reason.trim()) {
      toast.error('Captura un motivo de cancelación.');
      return;
    }
    try {
      await cancel.mutateAsync({ id: s.id, reason: reason.trim() });
      toast.success('Venta cancelada y stock reintegrado');
      setConfirmOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/caja">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">VTA-{s.folio}</h1>
            {isCancelled && (
              <Badge variant="destructive" className="uppercase text-[10px]">
                Cancelada
              </Badge>
            )}
            {isPartialReturn && (
              <span className="inline-flex items-center rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                Parcialmente devuelta
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                PAYMENT_METHOD_ACCENT[s.payment_method],
              )}
            >
              {PAYMENT_METHOD_LABELS[s.payment_method]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDateTime(s.created_at)} ·{' '}
            {s.customer?.name ?? 'Cliente general'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => printDocument('sale', s.id, 'termica')}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir ticket
          </Button>
          {!isCancelled && (
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Cancelar venta
            </Button>
          )}
        </div>
      </div>

      {isCancelled && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="font-medium text-destructive">Venta cancelada</p>
            <p className="text-xs text-muted-foreground">
              {s.cancelled_at && formatDateTime(s.cancelled_at)}
            </p>
            {s.cancel_reason && (
              <p className="text-sm">Motivo: {s.cancel_reason}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Desc.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="pr-6 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.items.map((it) => {
                const returnedQty = returnedByItem.get(it.id) ?? 0;
                const fullyReturned = returnedQty >= Number(it.quantity);
                const canReturn = !isCancelled && !fullyReturned;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="pl-6">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                          it.kind === 'producto'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-violet-500/15 text-violet-400',
                        )}
                      >
                        {it.kind === 'producto' ? 'Producto' : 'Abono'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {it.description}
                      {returnedQty > 0 && (
                        <span className="ml-2 text-[10px] text-amber-400">
                          (devuelto: {returnedQty})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {it.quantity}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {currency(it.unit_price)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {it.discount > 0 ? `−${currency(it.discount)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {currency(it.line_total)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canReturn}
                        onClick={() => setReturnItem(it)}
                        title={
                          fullyReturned
                            ? 'Línea totalmente devuelta'
                            : isCancelled
                              ? 'Venta cancelada'
                              : 'Devolver esta línea'
                        }
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        Devolver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Subtotal" value={currency(s.subtotal)} />
            <Row label="IVA" value={currency(s.iva_total)} />
            {s.discount_total > 0 && (
              <Row label="Descuentos" value={`−${currency(s.discount_total)}`} />
            )}
            <div className="my-2 h-px bg-border" />
            <Row label="TOTAL" value={currency(s.total)} strong />
          </CardContent>
        </Card>

        {s.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{s.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {returns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Devoluciones registradas</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Fecha</TableHead>
                  <TableHead>Línea</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Reembolso</TableHead>
                  <TableHead className="pr-6">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => {
                  const item = s.items.find((it) => it.id === r.sale_item_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item?.description ?? '(línea borrada)'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.quantity_returned}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {currency(r.refund_amount)}
                      </TableCell>
                      <TableCell className="pr-6 text-xs text-muted-foreground">
                        {r.reason ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {returnItem && (
        <ReturnItemDialog
          open={!!returnItem}
          onOpenChange={(v) => !v && setReturnItem(null)}
          item={returnItem}
          existingReturns={returns}
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar venta</DialogTitle>
            <DialogDescription>
              Se reintegrará el stock de los productos y se revertirán los abonos a
              órdenes. Esta acción queda registrada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cliente devolvió el producto, error de captura..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              No
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              <Ban className="mr-2 h-4 w-4" />
              {cancel.isPending ? 'Cancelando...' : 'Sí, cancelar venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-xs', strong && 'text-sm font-semibold')}>{label}</span>
      <span
        className={cn(
          'font-mono text-sm',
          strong && 'text-2xl font-bold tracking-tight',
        )}
      >
        {value}
      </span>
    </div>
  );
}
