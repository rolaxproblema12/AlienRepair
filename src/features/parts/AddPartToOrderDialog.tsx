import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Search } from 'lucide-react';
import { useAddPartToOrder, useParts } from './hooks';
import { usePartOnOrderSchema, type UsePartOnOrderInput } from './schemas';
import { PART_CATEGORY_COLOR, PART_CATEGORY_LABELS, type Part } from './types';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
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
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
}

export default function AddPartToOrderDialog({ open, onOpenChange, orderId }: Props) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const partsQ = useParts({ search: debounced, includeInactive: false });
  const [picked, setPicked] = useState<Part | null>(null);
  const add = useAddPartToOrder(orderId);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UsePartOnOrderInput>({
    resolver: zodResolver(usePartOnOrderSchema),
    defaultValues: { quantity: 1, unit_sale_price: 0, notes: '' },
  });

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPicked(null);
      setSearch('');
      reset({ quantity: 1, unit_sale_price: 0, notes: '' });
    }
  }, [open, reset]);

  function pick(p: Part) {
    setPicked(p);
    setValue('part_id', p.id);
    setValue('unit_sale_price', Number(p.cost_sale));
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!picked) {
      toast.error('Elige una pieza primero.');
      return;
    }
    if (values.quantity > picked.stock) {
      toast.error(`Stock insuficiente. Solo hay ${picked.stock} unidades.`);
      return;
    }
    try {
      await add.mutateAsync(values);
      toast.success('Pieza agregada a la orden');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar pieza a la orden</DialogTitle>
        </DialogHeader>

        {!picked ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca, modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {partsQ.isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : !partsQ.data?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin coincidencias.
                </p>
              ) : (
                partsQ.data.slice(0, 30).map((p) => {
                  const noStock = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => !noStock && pick(p)}
                      disabled={noStock}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border border-border bg-card p-2 text-left transition',
                        noStock
                          ? 'opacity-50'
                          : 'hover:border-primary/40 hover:bg-muted/30',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[9px] font-medium text-white',
                              PART_CATEGORY_COLOR[p.category],
                            )}
                          >
                            {PART_CATEGORY_LABELS[p.category]}
                          </span>
                        </div>
                        <div className="line-clamp-1 text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.brand} · {p.model} · Stock:{' '}
                          <strong className={noStock ? 'text-destructive' : ''}>
                            {p.stock}
                          </strong>{' '}
                          · {currency(p.cost_sale)}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{picked.name}</div>
              <div className="text-xs text-muted-foreground">
                {picked.brand} · {picked.model} · Stock disponible:{' '}
                <strong>{picked.stock}</strong>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={picked.stock}
                  step="1"
                  autoFocus
                  {...register('quantity', { valueAsNumber: true })}
                />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="unit_sale_price">Precio venta unitario</Label>
                <Input
                  id="unit_sale_price"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register('unit_sale_price', { valueAsNumber: true })}
                />
                {errors.unit_sale_price && (
                  <p className="text-xs text-destructive">
                    {errors.unit_sale_price.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPicked(null)}>
                Volver
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? 'Guardando...' : 'Agregar pieza'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
