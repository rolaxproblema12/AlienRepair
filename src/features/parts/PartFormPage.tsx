import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { usePart, useSavePart } from './hooks';
import { partSchema, type PartInput } from './schemas';
import { PART_CATEGORIES, PART_CATEGORY_LABELS, partMargin, partMarginPct } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export default function PartFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const partQ = usePart(id);
  const save = useSavePart();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PartInput>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      name: '',
      brand: '',
      model: '',
      category: 'pantalla',
      cost_purchase: 0,
      cost_sale: 0,
      min_stock: null,
      initial_stock: 0,
      notes: '',
      active: true,
    },
  });

  useEffect(() => {
    if (!isEdit || !partQ.data) return;
    const p = partQ.data;
    reset({
      name: p.name,
      brand: p.brand,
      model: p.model,
      category: p.category,
      cost_purchase: Number(p.cost_purchase),
      cost_sale: Number(p.cost_sale),
      min_stock: p.min_stock,
      initial_stock: 0,
      notes: p.notes ?? '',
      active: p.active,
    });
  }, [isEdit, partQ.data, reset]);

  const cost = Number(watch('cost_purchase') ?? 0);
  const sale = Number(watch('cost_sale') ?? 0);
  const margin = partMargin({ cost_purchase: cost, cost_sale: sale });
  const pct = partMarginPct({ cost_purchase: cost, cost_sale: sale });
  const active = watch('active');
  const category = watch('category');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id, values });
      toast.success(isEdit ? 'Pieza actualizada' : 'Pieza creada');
      navigate(`/piezas/${saved.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  if (isEdit && partQ.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/piezas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEdit ? 'Editar pieza' : 'Nueva pieza'}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="name">Nombre de la pieza *</Label>
              <Input id="name" {...register('name')} placeholder="Ej. Pantalla Galaxy A52" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="brand">Marca *</Label>
              <Input id="brand" {...register('brand')} placeholder="Samsung" />
              {errors.brand && (
                <p className="text-xs text-destructive">{errors.brand.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">Modelo *</Label>
              <Input id="model" {...register('model')} placeholder="A52 / A526B" />
              {errors.model && (
                <p className="text-xs text-destructive">{errors.model.message}</p>
              )}
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Categoría *</Label>
              <Select
                value={category}
                onValueChange={(v) => setValue('category', v as PartInput['category'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PART_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {PART_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precios</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cost_purchase">Costo de compra *</Label>
              <Input
                id="cost_purchase"
                type="number"
                step="0.01"
                min={0}
                {...register('cost_purchase', { valueAsNumber: true })}
              />
              {errors.cost_purchase && (
                <p className="text-xs text-destructive">{errors.cost_purchase.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cost_sale">Costo de venta *</Label>
              <Input
                id="cost_sale"
                type="number"
                step="0.01"
                min={0}
                {...register('cost_sale', { valueAsNumber: true })}
              />
              {errors.cost_sale && (
                <p className="text-xs text-destructive">{errors.cost_sale.message}</p>
              )}
            </div>
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
              Utilidad por unidad:{' '}
              <strong className={margin >= 0 ? 'text-emerald-400' : 'text-destructive'}>
                {currency(margin)}
              </strong>{' '}
              · Margen: <strong>{pct.toFixed(1)}%</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="min_stock">Stock mínimo (alerta)</Label>
              <Input
                id="min_stock"
                type="number"
                step="1"
                min={0}
                {...register('min_stock', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
              />
            </div>
            {!isEdit && (
              <div className="space-y-1">
                <Label htmlFor="initial_stock">Stock inicial</Label>
                <Input
                  id="initial_stock"
                  type="number"
                  step="1"
                  min={0}
                  {...register('initial_stock', { valueAsNumber: true })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Genera automáticamente un movimiento de entrada con motivo "Stock
                  inicial".
                </p>
              </div>
            )}
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Switch
                id="active"
                checked={active}
                onCheckedChange={(v) => setValue('active', v)}
              />
              <Label htmlFor="active">Activa</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="ghost">
            <Link to="/piezas">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear pieza'}
          </Button>
        </div>
      </form>
    </div>
  );
}
