import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useCloseSession, type DayBalance } from './hooks';
import { closeSessionSchema, type CloseSessionInput } from './schemas';
import type { CashSession } from './types';
import { currency } from '@/lib/format';
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
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: CashSession;
  balance: DayBalance | undefined;
}

export default function CashCloseDialog({ open, onOpenChange, session, balance }: Props) {
  const close = useCloseSession();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CloseSessionInput>({
    resolver: zodResolver(closeSessionSchema),
    defaultValues: { counted_cash: 0, closing_notes: '' },
  });

  useEffect(() => {
    if (open) reset({ counted_cash: 0, closing_notes: '' });
  }, [open, reset]);

  const counted = Number(watch('counted_cash') || 0);
  const expected = balance?.cashExpected ?? Number(session.opening_amount);
  const diff = counted - expected;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await close.mutateAsync({
        sessionId: session.id,
        values,
        expectedCash: expected,
      });
      toast.success('Caja cerrada');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar caja</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <Row label="Monto inicial" value={currency(session.opening_amount)} />
          <Row label="Ventas en efectivo" value={currency(balance?.byMethod.efectivo ?? 0)} />
          <div className="my-2 h-px bg-border" />
          <Row
            label="Efectivo esperado"
            value={currency(expected)}
            strong
          />
          <Row label="Tarjeta" value={currency(balance?.byMethod.tarjeta ?? 0)} muted />
          <Row
            label="Transferencia"
            value={currency(balance?.byMethod.transferencia ?? 0)}
            muted
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="counted_cash">Efectivo contado</Label>
            <Input
              id="counted_cash"
              type="number"
              step="0.01"
              min={0}
              autoFocus
              {...register('counted_cash', { valueAsNumber: true })}
            />
            {errors.counted_cash && (
              <p className="text-xs text-destructive">{errors.counted_cash.message}</p>
            )}
          </div>

          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              diff === 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-destructive/40 bg-destructive/5 text-destructive',
            )}
          >
            Diferencia:{' '}
            <strong>
              {diff > 0 ? '+' : ''}
              {currency(diff)}
            </strong>
            {diff !== 0 && (
              <p className="mt-1 text-xs">
                {diff > 0
                  ? 'Hay más efectivo del esperado.'
                  : 'Falta efectivo respecto a lo esperado.'}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="closing_notes">Notas (opcional)</Label>
            <Textarea
              id="closing_notes"
              rows={2}
              placeholder="Diferencia justificada por..."
              {...register('closing_notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={close.isPending}>
              {close.isPending ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-xs', muted ? 'text-muted-foreground' : '')}>{label}</span>
      <span
        className={cn(
          'font-mono',
          strong && 'font-semibold text-foreground',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}
