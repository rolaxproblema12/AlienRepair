import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowUpFromLine, Settings2 } from 'lucide-react';
import { useRecordPartMovement } from './hooks';
import { partMovementSchema, type PartMovementInput } from './schemas';
import type { Part, PartMovementKind } from './types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  part: Part;
}

const KIND_TABS: { key: PartMovementKind; label: string; icon: typeof ArrowDownToLine }[] = [
  { key: 'entrada', label: 'Entrada', icon: ArrowDownToLine },
  { key: 'salida', label: 'Salida', icon: ArrowUpFromLine },
  { key: 'ajuste', label: 'Ajuste', icon: Settings2 },
];

const DEFAULT_REASON: Record<PartMovementKind, string> = {
  entrada: 'Compra a proveedor',
  salida: 'Uso/venta directa',
  ajuste: 'Ajuste de inventario',
};

export default function PartMovementDialog({ open, onOpenChange, part }: Props) {
  const [kind, setKind] = useState<PartMovementKind>('entrada');
  const record = useRecordPartMovement(part.id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PartMovementInput>({
    resolver: zodResolver(partMovementSchema),
    defaultValues: {
      kind: 'entrada',
      quantity: 1,
      reason: DEFAULT_REASON.entrada,
      reference: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      kind: 'entrada',
      quantity: 1,
      reason: DEFAULT_REASON.entrada,
      reference: '',
    });
    setKind('entrada');
  }, [open, reset]);

  function switchKind(k: PartMovementKind) {
    setKind(k);
    reset({
      kind: k,
      quantity: k === 'ajuste' ? 0 : 1,
      reason: DEFAULT_REASON[k],
      reference: '',
    });
  }

  const quantity = watch('quantity');
  const projectedStock =
    kind === 'entrada'
      ? part.stock + Math.abs(Number(quantity) || 0)
      : kind === 'salida'
        ? part.stock - Math.abs(Number(quantity) || 0)
        : part.stock + (Number(quantity) || 0);

  const submit = handleSubmit(async (values) => {
    if (kind === 'salida' && projectedStock < 0) {
      toast.error('Stock insuficiente.');
      return;
    }
    try {
      await record.mutateAsync({ ...values, kind });
      toast.success('Movimiento registrado');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div className="font-medium">{part.name}</div>
          <div className="text-xs text-muted-foreground">
            {part.brand} · {part.model} · Stock actual: <strong>{part.stock}</strong>
          </div>
        </div>

        <div className="inline-flex w-full rounded-md border border-border bg-card p-0.5">
          {KIND_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchKind(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition',
                kind === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="quantity">
              {kind === 'ajuste' ? 'Cantidad (puede ser negativa)' : 'Cantidad'}
            </Label>
            <Input
              id="quantity"
              type="number"
              step="1"
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Stock proyectado:{' '}
              <strong className={cn(projectedStock < 0 && 'text-destructive')}>
                {projectedStock}
              </strong>
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="reason">Motivo</Label>
            <Input id="reason" {...register('reason')} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Textarea
              id="reference"
              rows={2}
              placeholder="Folio, factura, OS-XXXX..."
              {...register('reference')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? 'Guardando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
