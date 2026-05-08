import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAddOrderPayment, useCurrentSession } from './hooks';
import { orderPaymentSchema, type OrderPaymentInput } from './schemas';
import { PAYMENT_METHOD_LABELS } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  folio: string;
  balance: number;
}

export default function OrderPaymentDialog({
  open,
  onOpenChange,
  orderId,
  folio,
  balance,
}: Props) {
  const sessionQ = useCurrentSession();
  const add = useAddOrderPayment(orderId);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<OrderPaymentInput>({
    resolver: zodResolver(orderPaymentSchema),
    defaultValues: { amount: balance, payment_method: 'efectivo', notes: '' },
  });

  useEffect(() => {
    if (open) reset({ amount: balance, payment_method: 'efectivo', notes: '' });
  }, [open, balance, reset]);

  const method = watch('payment_method');
  const amount = Number(watch('amount') || 0);

  const onSubmit = handleSubmit(async (values) => {
    if (values.amount > balance) {
      toast.error('El monto excede el saldo pendiente.');
      return;
    }
    try {
      await add.mutateAsync(values);
      toast.success('Abono registrado');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar abono · OS-{folio}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          Saldo pendiente: <strong>{currency(balance)}</strong>
        </div>

        {!sessionQ.data && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
            ⚠ No hay sesión de caja abierta. El pago se registrará pero no quedará
            vinculado al saldo del día.
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="amount">Monto a abonar</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={0}
              max={balance}
              autoFocus
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
            {amount > balance && (
              <p className="text-xs text-destructive">
                Excede el saldo en {currency(amount - balance)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Método de pago</Label>
            <div className="inline-flex w-full rounded-md border border-border bg-card p-0.5">
              {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setValue('payment_method', m)}
                  className={cn(
                    'flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition',
                    method === m
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={add.isPending || amount <= 0 || amount > balance}
            >
              {add.isPending ? 'Guardando...' : `Abonar ${currency(amount)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
