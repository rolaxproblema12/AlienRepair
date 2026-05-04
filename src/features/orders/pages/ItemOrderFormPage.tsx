import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useOrder, useSaveItemOrder } from '../hooks';
import { itemOrderSchema, type ItemOrderInput } from '../itemSchema';
import {
  DEVICE_TYPE_LABELS,
  ITEM_STATUSES,
  STATUS_LABELS,
  supportsDevicePassword,
  type DeviceType,
  type OrderKind,
} from '../types';
import CustomerFormDialog from '@/features/customers/CustomerFormDialog';
import CustomerCombobox from '@/components/customers/CustomerCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

const DEVICE_TYPE_NONE = '__none__';

interface Props {
  kind: Extract<OrderKind, 'encargo' | 'accesorio'>;
}

const COPY = {
  encargo: { title: 'encargo', route: '/encargos' },
  accesorio: { title: 'accesorio', route: '/accesorios' },
} as const;

export default function ItemOrderFormPage({ kind }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const existing = useOrder(id);
  const save = useSaveItemOrder(kind);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  const copy = COPY[kind];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ItemOrderInput>({
    resolver: zodResolver(itemOrderSchema),
    defaultValues: {
      customer_id: '',
      item_description: '',
      device_type: null,
      device_password: '',
      cost: 0,
      down_payment: 0,
      estimated_delivery: '',
      notes: '',
      status: 'pendiente',
    },
  });

  useEffect(() => {
    if (id && existing.data) {
      reset({
        customer_id: existing.data.customer_id,
        item_description: existing.data.item_description ?? '',
        device_type: existing.data.device_type ?? null,
        device_password: existing.data.device_password ?? '',
        cost: Number(existing.data.cost),
        down_payment: Number(existing.data.down_payment),
        estimated_delivery: existing.data.estimated_delivery ?? '',
        notes: existing.data.notes ?? '',
        status: existing.data.status,
      });
    }
  }, [id, existing.data, reset]);

  const selectedCustomerId = watch('customer_id');
  const cost = watch('cost');
  const down = watch('down_payment');
  const saldo = (Number(cost) || 0) - (Number(down) || 0);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id, values });
      toast.success(id ? 'Actualizado' : `#${saved.folio} creado`);
      navigate(`${copy.route}/${saved.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  const isNew = !id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        to={id ? `${copy.route}/${id}` : copy.route}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight capitalize">
        {isNew ? `Nuevo ${copy.title}` : `Editar ${copy.title} #${existing.data?.folio ?? ''}`}
      </h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Seleccionar cliente</Label>
            <CustomerCombobox
              value={selectedCustomerId || null}
              onChange={(v) => setValue('customer_id', v, { shouldValidate: true })}
              onCreateNew={() => setCustomerDialogOpen(true)}
              error={errors.customer_id?.message}
            />
          </CardContent>
        </Card>

        {kind === 'encargo' && (
          <Card>
            <CardHeader>
              <CardTitle>Dispositivo (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de dispositivo</Label>
                <Select
                  value={watch('device_type') ?? DEVICE_TYPE_NONE}
                  onValueChange={(v) =>
                    setValue(
                      'device_type',
                      v === DEVICE_TYPE_NONE ? null : (v as DeviceType),
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEVICE_TYPE_NONE}>No aplica</SelectItem>
                    {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {supportsDevicePassword(watch('device_type')) && (
                <div className="space-y-2">
                  <Label htmlFor="device_password">
                    Contraseña / PIN / Patrón del dispositivo
                  </Label>
                  <Input
                    id="device_password"
                    autoComplete="off"
                    placeholder="Ej: 1234, patrón 1-4-7-8-5, contraseña Windows, o deja en blanco"
                    {...register('device_password')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se guarda junto con el encargo. Se muestra en el detalle.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item_description">Artículo / descripción</Label>
              <Textarea
                id="item_description"
                rows={3}
                placeholder={
                  kind === 'encargo'
                    ? 'Ej: Laptop Lenovo Legion 5, 16GB RAM, SSD 1TB'
                    : 'Ej: Funda silicona Galaxy A52, color negro'
                }
                {...register('item_description')}
              />
              {errors.item_description && (
                <p className="text-xs text-destructive">{errors.item_description.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cost">Costo</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register('cost', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="down_payment">Anticipo</Label>
                <Input
                  id="down_payment"
                  type="number"
                  step="0.01"
                  min={0}
                  {...register('down_payment', { valueAsNumber: true })}
                />
                {errors.down_payment && (
                  <p className="text-xs text-destructive">{errors.down_payment.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Saldo</Label>
                <div className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium">
                  {currency(saldo)}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_delivery">Fecha estimada de entrega</Label>
              <Input
                id="estimated_delivery"
                type="date"
                {...register('estimated_delivery')}
              />
            </div>
            {!isNew && (
              <div className="space-y-2">
                <Label>Estatus</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(v) => setValue('status', v as ItemOrderInput['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>

      <CustomerFormDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        onSaved={(c) => {
          setValue('customer_id', c.id, { shouldValidate: true });
          toast.success(`Cliente ${c.name} asignado a la orden`);
        }}
      />
    </div>
  );
}
