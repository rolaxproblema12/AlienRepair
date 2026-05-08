import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCustomerActiveOrders,
  useCustomerWarrantyOrders,
} from '@/features/customers/hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useMaybeSucursalId } from '@/features/sucursales/useScopedSucursalId';
import { useOrder, useSaveRepairOrder } from '../hooks';
import { repairOrderSchema, type RepairOrderInput } from '../schemas';
import {
  DEVICE_TYPE_LABELS,
  ORDER_STATUSES,
  STATUS_LABELS,
  WARRANTY_VOIDING_REASONS,
  supportsDevicePassword,
} from '../types';
import IntakeChecklistFields from '../IntakeChecklistFields';
import CustomerFormDialog from '@/features/customers/CustomerFormDialog';
import CustomerCombobox from '@/components/customers/CustomerCombobox';
import CatalogSuggestions from '@/features/catalog/CatalogSuggestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export default function OrderFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const presetCustomer = searchParams.get('cliente');
  const navigate = useNavigate();
  const existing = useOrder(id);
  const save = useSaveRepairOrder();
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  const sucursalId = useMaybeSucursalId();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<RepairOrderInput>({
    resolver: zodResolver(repairOrderSchema),
    defaultValues: {
      customer_id: presetCustomer ?? '',
      device_type: 'celular',
      brand: '',
      model: '',
      color: '',
      device_password: '',
      problem: '',
      cost: 0,
      down_payment: 0,
      estimated_delivery: '',
      notes: '',
      status: 'pendiente',
      warranty_claim_of: null,
      intake_checklist_applies: null,
      intake_checklist_reason: null,
      intake_checklist_reason_other: null,
      intake_checklist: null,
      warranty_void: false,
      warranty_void_reason: null,
    },
  });

  // Cambio de sucursal mid-form: la OS de la sucursal A no es accesible
  // en B (RLS lo bloquea); el form abierto con datos de A no debe seguir
  // visible. Avisar y volver a la lista.
  const lastSucursalRef = useRef(sucursalId);
  useEffect(() => {
    if (lastSucursalRef.current !== sucursalId) {
      const prevSucursal = lastSucursalRef.current;
      lastSucursalRef.current = sucursalId;
      // Solo avisar si había una sucursal previa (no en mount inicial).
      if (prevSucursal != null) {
        if (id) {
          toast.warning('OS no disponible en esta sucursal');
        } else if (isDirty) {
          toast.warning('Cambios descartados por cambio de sucursal');
        }
        navigate('/reparaciones');
      }
    }
  }, [sucursalId, id, isDirty, navigate]);

  useEffect(() => {
    if (id && existing.data) {
      reset({
        customer_id: existing.data.customer_id,
        device_type: existing.data.device_type ?? 'celular',
        brand: existing.data.brand ?? '',
        model: existing.data.model ?? '',
        color: existing.data.color ?? '',
        device_password: existing.data.device_password ?? '',
        problem: existing.data.problem ?? '',
        cost: Number(existing.data.cost),
        down_payment: Number(existing.data.down_payment),
        estimated_delivery: existing.data.estimated_delivery ?? '',
        notes: existing.data.notes ?? '',
        status: existing.data.status,
        warranty_claim_of: existing.data.warranty_claim_of ?? null,
        intake_checklist_applies: existing.data.intake_checklist_applies ?? null,
        intake_checklist_reason: existing.data.intake_checklist_reason ?? null,
        intake_checklist_reason_other: existing.data.intake_checklist_reason_other ?? null,
        intake_checklist: existing.data.intake_checklist ?? null,
        warranty_void: existing.data.warranty_void ?? false,
        warranty_void_reason: existing.data.warranty_void_reason ?? null,
      });
    }
  }, [id, existing.data, reset]);

  const intakeReason = watch('intake_checklist_reason');
  const intakeApplies = watch('intake_checklist_applies');
  const warrantyVoidReason = watch('warranty_void_reason');
  useEffect(() => {
    const shouldVoid =
      intakeApplies === false &&
      !!intakeReason &&
      WARRANTY_VOIDING_REASONS.includes(intakeReason);
    if (shouldVoid) {
      setValue('warranty_void', true, { shouldDirty: true });
      setValue('warranty_void_reason', intakeReason, { shouldDirty: true });
    } else if (
      // Solo auto-desmarcar lo que el effect mismo había marcado (mojado/sin_codigo).
      // Respeta warranty_void manual (warranty_void_reason='manual' u otro valor custom).
      warrantyVoidReason === 'mojado' ||
      warrantyVoidReason === 'sin_codigo'
    ) {
      setValue('warranty_void', false, { shouldDirty: true });
      setValue('warranty_void_reason', null, { shouldDirty: true });
    }
  }, [intakeApplies, intakeReason, warrantyVoidReason, setValue]);

  const selectedCustomerId = watch('customer_id');
  const cost = watch('cost');
  const down = watch('down_payment');
  const warrantyClaimOf = watch('warranty_claim_of');
  const activeOrders = useCustomerActiveOrders(selectedCustomerId || undefined);
  const { current: sucursal } = useCurrentSucursal();
  const warrantyOrders = useCustomerWarrantyOrders(
    selectedCustomerId || undefined,
    sucursal?.warranty_days ?? 0,
  );
  // Excluir esta misma OS al editar (no avisar de "garantía de sí misma").
  const eligibleWarranty = (warrantyOrders.data ?? []).filter((o) => o.id !== id);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id, values });
      toast.success(id ? 'Orden actualizada' : `Orden #${saved.folio} creada`);
      navigate(`/reparaciones/${saved.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  const isNew = !id;
  const numCost = Number(cost) || 0;
  const numDown = Number(down) || 0;
  const saldo = numCost - numDown;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        to={id ? `/reparaciones/${id}` : '/reparaciones'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">
        {isNew ? 'Nueva orden de reparación' : `Editar orden #${existing.data?.folio ?? ''}`}
      </h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Seleccionar cliente</Label>
              <CustomerCombobox
                value={selectedCustomerId || null}
                onChange={(v) => setValue('customer_id', v, { shouldValidate: true })}
                onCreateNew={() => setCustomerDialogOpen(true)}
                error={errors.customer_id?.message}
              />
            </div>

            {selectedCustomerId && (activeOrders.data ?? 0) > (id ? 1 : 0) && (
              <Badge variant="warning">
                Este cliente tiene {activeOrders.data} órden(es) activa(s) además de ésta.
              </Badge>
            )}

            {eligibleWarranty.length > 0 && !id && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-amber-200">
                  ⚠️ Posible reclamo de garantía
                </p>
                <p className="mt-1 text-xs text-amber-100/80">
                  Este cliente tiene {eligibleWarranty.length} OS entregada(s)
                  dentro de los últimos {sucursal?.warranty_days ?? 0} días.
                  Si esta nueva OS es por la misma falla, marcala como
                  reclamo de garantía:
                </p>
                <div className="mt-2 space-y-1">
                  {eligibleWarranty.map((o) => {
                    const days = Math.floor(
                      (Date.now() - new Date(o.delivered_at).getTime()) /
                        86_400_000,
                    );
                    const isPicked = warrantyClaimOf === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() =>
                          setValue('warranty_claim_of', isPicked ? null : o.id, {
                            shouldDirty: true,
                          })
                        }
                        className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs transition ${
                          isPicked
                            ? 'border-amber-400 bg-amber-500/20'
                            : 'border-amber-500/30 bg-transparent hover:bg-amber-500/10'
                        }`}
                      >
                        <span>
                          <span className="font-mono">#{o.folio}</span>
                          <span className="ml-2 text-amber-100/70">
                            {[o.brand, o.model].filter(Boolean).join(' ')}
                            {o.problem ? ` · ${o.problem}` : ''}
                          </span>
                        </span>
                        <span className="text-amber-100/60">
                          hace {days} día{days === 1 ? '' : 's'}
                          {isPicked && ' ✓'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {warrantyClaimOf && (
                  <p className="mt-2 text-xs text-amber-200">
                    Marcada como reclamo de garantía. Considera poner cost=0
                    si no se cobra al cliente.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={watch('device_type')}
                  onValueChange={(v) => setValue('device_type', v as RepairOrderInput['device_type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" {...register('color')} placeholder="Negro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input id="brand" {...register('brand')} placeholder="Samsung" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input id="model" {...register('model')} placeholder="Galaxy A52" />
              </div>
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
                  Necesaria para probar la reparación. Se guarda junto con la orden.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="problem">Problema reportado</Label>
              <Textarea id="problem" rows={3} {...register('problem')} />
              {errors.problem && (
                <p className="text-xs text-destructive">{errors.problem.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <IntakeChecklistFields
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
        />

        <CatalogSuggestions
          brand={watch('brand')}
          model={watch('model')}
          problem={watch('problem')}
          onUseSuggestedPrice={(price) =>
            setValue('cost', price, { shouldValidate: true, shouldDirty: true })
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Costos y fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                {!errors.down_payment && numDown > numCost && numCost > 0 && (
                  <p className="text-xs text-destructive">
                    El anticipo excede el costo
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Saldo</Label>
                <div className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-medium">
                  {currency(saldo)}
                </div>
                <p className="text-xs text-muted-foreground">
                  = costo − anticipo (calculado automáticamente)
                </p>
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
                  onValueChange={(v) => setValue('status', v as RepairOrderInput['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" rows={3} {...register('notes')} />
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
