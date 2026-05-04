import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useSaveCategory } from './hooks';
import { categorySchema, type CategoryInput } from './schemas';
import type { ProductCategory } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  category?: ProductCategory | null;
}

const COLOR_OPTIONS = [
  { value: 'bg-cyan-500', name: 'Cian' },
  { value: 'bg-violet-500', name: 'Violeta' },
  { value: 'bg-orange-500', name: 'Naranja' },
  { value: 'bg-emerald-500', name: 'Verde' },
  { value: 'bg-rose-500', name: 'Rosa' },
  { value: 'bg-amber-500', name: 'Ámbar' },
  { value: 'bg-blue-500', name: 'Azul' },
  { value: 'bg-zinc-500', name: 'Gris' },
];

export default function CategoryFormDialog({ open, onOpenChange, category }: Props) {
  const save = useSaveCategory();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', color: null },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      category
        ? { name: category.name, color: category.color }
        : { name: '', color: null },
    );
  }, [open, category, reset]);

  const color = watch('color');

  const submit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: category?.id, values });
      toast.success(category ? 'Categoría actualizada' : 'Categoría creada');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Editar categoría' : 'Nueva categoría'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Color (badge)</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setValue('color', null)}
                className={cn(
                  'h-8 rounded-md border border-dashed border-border px-3 text-xs',
                  !color && 'border-primary text-primary',
                )}
              >
                Sin color
              </button>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setValue('color', c.value)}
                  className={cn(
                    'h-8 w-8 rounded-md border-2 transition',
                    c.value,
                    color === c.value
                      ? 'border-foreground'
                      : 'border-transparent',
                  )}
                  title={c.name}
                />
              ))}
            </div>
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
