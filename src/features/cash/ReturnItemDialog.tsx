import { useState } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { useReturnSaleItem } from './hooks';
import type { SaleItem, SaleReturn } from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Línea sobre la que se va a registrar la devolución. */
  item: SaleItem;
  /** Devoluciones previas de esta misma línea (para validar que qty no exceda). */
  existingReturns: SaleReturn[];
}

export default function ReturnItemDialog({
  open,
  onOpenChange,
  item,
  existingReturns,
}: Props) {
  const mutation = useReturnSaleItem();

  const alreadyReturned = existingReturns
    .filter((r) => r.sale_item_id === item.id)
    .reduce((s, r) => s + Number(r.quantity_returned), 0);
  const maxQty = Number(item.quantity) - alreadyReturned;

  // SaleDetailPage monta este dialog solo cuando hay item activo (con `returnItem && <Dialog>`)
  // y lo desmonta al cerrar, así que useState calcula los defaults frescos cada vez.
  const [qty, setQty] = useState<string>(String(maxQty));
  const [refund, setRefund] = useState<string>(
    (maxQty * Number(item.unit_price)).toFixed(2),
  );
  const [reason, setReason] = useState('');

  const qtyNum = Number(qty);
  const refundNum = Number(refund);
  const valid =
    Number.isFinite(qtyNum) &&
    qtyNum > 0 &&
    qtyNum <= maxQty &&
    Number.isFinite(refundNum) &&
    refundNum > 0;

  async function handleSubmit() {
    if (!valid) {
      toast.error('Revisa cantidad y monto.');
      return;
    }
    try {
      await mutation.mutateAsync({
        sale_id: item.sale_id,
        sale_item_id: item.id,
        quantity_returned: qtyNum,
        refund_amount: refundNum,
        reason: reason.trim() || null,
        order_id: item.order_id,
      });
      toast.success(
        item.kind === 'producto'
          ? 'Devolución registrada — stock reintegrado'
          : 'Devolución registrada — abono revertido',
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver línea</DialogTitle>
          <DialogDescription>
            {item.kind === 'producto'
              ? 'Reintegra stock al inventario y registra el reembolso.'
              : 'Revierte el abono aplicado a la orden de servicio.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="font-medium">{item.description}</div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>
              Cantidad original: <strong className="text-foreground">{item.quantity}</strong>
            </span>
            <span>
              Ya devuelto: <strong className="text-foreground">{alreadyReturned}</strong>
            </span>
            <span>
              Disponible: <strong className="text-foreground">{maxQty}</strong>
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Precio unitario: <strong className="text-foreground">{currency(item.unit_price)}</strong>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="qty">Cantidad a devolver</Label>
            <Input
              id="qty"
              type="number"
              min={0}
              max={maxQty}
              step="1"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                // Auto-actualizar refund si el user no lo tocó (heurística simple).
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  setRefund((n * Number(item.unit_price)).toFixed(2));
                }
              }}
            />
            {qtyNum > maxQty && (
              <p className="text-xs text-destructive">Excede lo disponible ({maxQty}).</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="refund">Monto a reembolsar</Label>
            <Input
              id="refund"
              type="number"
              min={0}
              step="0.01"
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Textarea
            id="reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cliente devolvió producto defectuoso, error de captura, etc."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || mutation.isPending}>
            <Undo2 className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Procesando…' : 'Confirmar devolución'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
