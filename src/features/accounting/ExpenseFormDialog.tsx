import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSaveExpense } from './hooks';
import OrderForExpenseCombobox from './OrderForExpenseCombobox';
import { expenseSchema, type ExpenseInput } from './schemas';
import { EXPENSE_KIND_LABELS, type ExpenseWithOrder } from './types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { todayIso } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense?: ExpenseWithOrder | null;
  defaultOrderId?: string;
}

export default function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  defaultOrderId,
}: Props) {
  const save = useSaveExpense();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      kind: defaultOrderId ? 'refaccion' : 'general',
      order_id: defaultOrderId ?? null,
      description: '',
      amount: 0,
      spent_at: todayIso(),
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (expense) {
      reset({
        kind: expense.kind,
        order_id: expense.order_id,
        description: expense.description,
        amount: Number(expense.amount),
        spent_at: expense.spent_at,
        notes: expense.notes ?? '',
      });
    } else {
      reset({
        kind: defaultOrderId ? 'refaccion' : 'general',
        order_id: defaultOrderId ?? null,
        description: '',
        amount: 0,
        spent_at: todayIso(),
        notes: '',
      });
    }
  }, [open, expense, defaultOrderId, reset]);

  const kind = watch('kind');
  const orderId = watch('order_id');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: expense?.id, values });
      toast.success(expense ? 'Gasto actualizado' : 'Gasto registrado');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setValue('kind', v as ExpenseInput['kind']);
                  if (v === 'general') setValue('order_id', null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_KIND_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spent_at">Fecha</Label>
              <Input id="spent_at" type="date" {...register('spent_at')} />
              {errors.spent_at && (
                <p className="text-xs text-destructive">{errors.spent_at.message}</p>
              )}
            </div>
          </div>

          {kind === 'refaccion' && (
            <div className="space-y-2">
              <Label>Orden asociada</Label>
              <OrderForExpenseCombobox
                value={orderId ?? null}
                onChange={(id) => setValue('order_id', id, { shouldValidate: true })}
                error={errors.order_id?.message}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              placeholder={
                kind === 'refaccion'
                  ? 'Ej: Pantalla Galaxy A52'
                  : 'Ej: Renta mostrador marzo'
              }
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={0}
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
