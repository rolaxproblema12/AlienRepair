import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useCategories, useProduct, useSaveProduct } from './hooks';
import { productSchema, type ProductInput } from './schemas';
import { marginAmount, marginPct } from './types';
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

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const categoriesQ = useCategories();
  const productQ = useProduct(id);
  const save = useSaveProduct();

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      barcode: searchParams.get('barcode') ?? '',
      category_id: '',
      brand: '',
      model: '',
      supplier: '',
      description: '',
      notes: '',
      cost_price: 0,
      sale_price: 0,
      iva_rate: 0.16,
      min_stock: null,
      initial_stock: 0,
      active: true,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!isEdit || !productQ.data) return;
    const p = productQ.data;
    reset({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? '',
      category_id: p.category_id,
      brand: p.brand ?? '',
      model: p.model ?? '',
      supplier: p.supplier ?? '',
      description: p.description ?? '',
      notes: p.notes ?? '',
      cost_price: Number(p.cost_price),
      sale_price: Number(p.sale_price),
      iva_rate: Number(p.iva_rate),
      min_stock: p.min_stock,
      initial_stock: 0,
      active: p.active,
    });
  }, [isEdit, productQ.data, reset]);

  const cost = Number(watch('cost_price') ?? 0);
  const sale = Number(watch('sale_price') ?? 0);
  const margin = marginAmount({ cost_price: cost, sale_price: sale });
  const pct = marginPct({ cost_price: cost, sale_price: sale });
  const ivaRate = Number(watch('iva_rate') ?? 0);
  const active = watch('active');
  const categoryId = watch('category_id');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id, values });
      toast.success(isEdit ? 'Producto actualizado' : 'Producto creado');
      navigate(`/inventario/${saved.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  if (isEdit && productQ.isLoading) {
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
          <Link to="/inventario">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isEdit ? 'Editar producto' : 'Nuevo producto'}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" {...register('sku')} />
              {errors.sku && (
                <p className="text-xs text-destructive">{errors.sku.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input id="barcode" {...register('barcode')} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Categoría *</Label>
              <Select
                value={categoryId}
                onValueChange={(v) =>
                  setValue('category_id', v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-xs text-destructive">{errors.category_id.message}</p>
              )}
              {!categoriesQ.data?.length && (
                <p className="text-xs text-muted-foreground">
                  No hay categorías. Pídele al admin que cree una en{' '}
                  <Link to="/admin/categorias" className="underline">
                    /admin/categorias
                  </Link>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comercial</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="cost_price">Precio costo *</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min={0}
                {...register('cost_price', { valueAsNumber: true })}
              />
              {errors.cost_price && (
                <p className="text-xs text-destructive">{errors.cost_price.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sale_price">Precio venta *</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min={0}
                {...register('sale_price', { valueAsNumber: true })}
              />
              {errors.sale_price && (
                <p className="text-xs text-destructive">{errors.sale_price.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="iva_rate">IVA (%)</Label>
              <Input
                id="iva_rate"
                type="number"
                step="0.01"
                min={0}
                max={1}
                {...register('iva_rate', { valueAsNumber: true })}
              />
              <p className="text-[10px] text-muted-foreground">
                Decimal: 0.16 = 16%
              </p>
            </div>
            <div className="sm:col-span-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
              Utilidad por unidad:{' '}
              <strong
                className={
                  margin >= 0 ? 'text-emerald-400' : 'text-destructive'
                }
              >
                {currency(margin)}
              </strong>{' '}
              · Margen: <strong>{pct.toFixed(1)}%</strong> · IVA aplicado:{' '}
              <strong>{(ivaRate * 100).toFixed(1)}%</strong>
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
                  Crea automáticamente un movimiento de entrada con motivo "Stock
                  inicial".
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" {...register('brand')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" {...register('model')} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input id="supplier" {...register('supplier')} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" rows={2} {...register('description')} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Switch
                id="active"
                checked={active}
                onCheckedChange={(v) => setValue('active', v)}
              />
              <Label htmlFor="active">Activo</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="ghost">
            <Link to="/inventario">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
