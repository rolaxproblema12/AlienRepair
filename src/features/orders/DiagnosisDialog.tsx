import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Search, Stethoscope } from 'lucide-react';
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
import { useOrders, useSaveDiagnosis } from './hooks';
import { diagnosisSchema, type DiagnosisInput } from './schemas';
import { STATUS_LABELS, type OrderWithCustomer } from './types';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useSucursalSettingsMap } from '@/features/admin/sucursalConfig/hooks';
import { buildDiagnosisMessage, openWhatsApp } from '@/lib/whatsapp';
import { useDebouncedValue } from '@/lib/hooks';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /**
   * Si se pasa, el dialog va directo al formulario.
   * Si se omite, muestra primero un picker de OS abiertas.
   */
  order?: OrderWithCustomer;
}

export default function DiagnosisDialog({ open, onOpenChange, order }: Props) {
  const [picked, setPicked] = useState<OrderWithCustomer | null>(null);
  const active = order ?? picked;

  const handleOpenChange = (next: boolean) => {
    if (!next) setPicked(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {active ? (
          <DiagnosisForm
            order={active}
            showBack={!order}
            onBack={() => setPicked(null)}
            onDone={() => handleOpenChange(false)}
            onCancel={() => handleOpenChange(false)}
          />
        ) : (
          <OrderPicker
            onPick={setPicked}
            onCancel={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Picker de OS abiertas (modo standalone)
// ---------------------------------------------------------------------------

function OrderPicker({
  onPick,
  onCancel,
}: {
  onPick: (o: OrderWithCustomer) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { data, isLoading } = useOrders({
    kind: 'reparacion',
    status: 'all',
    search: debounced,
  });

  const open = useMemo(
    () => (data ?? []).filter((o) => o.status !== 'entregado').slice(0, 30),
    [data],
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nuevo diagnóstico</DialogTitle>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        Selecciona la orden de reparación a la que vas a registrarle el diagnóstico.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Buscar por folio, cliente, marca o problema…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/20 p-1">
        {isLoading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Cargando órdenes…</p>
        ) : open.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {search.trim()
              ? 'No se encontraron órdenes que coincidan.'
              : 'No hay órdenes de reparación abiertas.'}
          </p>
        ) : (
          open.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o)}
              className="flex w-full items-start justify-between gap-3 rounded px-3 py-2 text-left transition hover:bg-secondary"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold">#{o.folio}</span>
                  <span className="truncate text-sm">
                    {o.customer?.name ?? 'Sin cliente'}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[o.brand, o.model].filter(Boolean).join(' ') || 'Sin equipo'}
                  {o.problem ? ` · ${o.problem}` : ''}
                </p>
              </div>
              <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {STATUS_LABELS[o.status]}
              </span>
            </button>
          ))
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Form de diagnóstico (compartido entre modos inline y standalone)
// ---------------------------------------------------------------------------

function DiagnosisForm({
  order,
  showBack,
  onBack,
  onDone,
  onCancel,
}: {
  order: OrderWithCustomer;
  showBack: boolean;
  onBack: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const save = useSaveDiagnosis(order.id);
  const { current: sucursal } = useCurrentSucursal();
  const { map: settingsMap } = useSucursalSettingsMap(sucursal?.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DiagnosisInput>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: { diagnosis: order.diagnosis ?? '' },
  });

  useEffect(() => {
    reset({ diagnosis: order.diagnosis ?? '' });
  }, [order.id, order.diagnosis, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        diagnosis: values.diagnosis,
        currentStatus: order.status,
      });
      onDone();

      const phone = saved.customer?.phone ?? order.customer?.phone ?? null;
      const customerName = saved.customer?.name ?? order.customer?.name ?? '';
      const template = settingsMap.get('msg_diagnosis');
      const message = buildDiagnosisMessage(
        customerName,
        saved.folio,
        values.diagnosis.trim(),
        { shopName: sucursal?.name, template },
      );

      toast.success('Diagnóstico guardado correctamente', {
        description: phone
          ? `Notificar a ${customerName} por WhatsApp?`
          : 'Cliente sin teléfono — no se puede enviar WhatsApp.',
        duration: 8_000,
        action: phone
          ? {
              label: 'Enviar WhatsApp',
              onClick: () => {
                openWhatsApp(phone, message).catch((err) => {
                  toast.error(`Error abriendo WhatsApp: ${getErrorMessage(err)}`);
                });
              },
            }
          : undefined,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  const customerName = order.customer?.name ?? 'Sin cliente';

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {showBack && <Stethoscope className="h-5 w-5" />}
          Diagnóstico · #{order.folio} · {customerName}
        </DialogTitle>
      </DialogHeader>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Equipo:{' '}
        <strong className="text-foreground">
          {[order.brand, order.model].filter(Boolean).join(' ') || '—'}
        </strong>
        {order.problem && (
          <>
            <br />
            Falla reportada: <span className="text-foreground">{order.problem}</span>
          </>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="diagnosis">Diagnóstico técnico</Label>
          <Textarea
            id="diagnosis"
            rows={6}
            autoFocus
            placeholder="Ej: Pantalla rota, batería al 60%, requiere cambio de display y batería. Costo aproximado $850."
            {...register('diagnosis')}
          />
          {errors.diagnosis && (
            <p className="text-xs text-destructive">{errors.diagnosis.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Si la OS está en <strong>Pendiente</strong> pasa automáticamente a{' '}
            <strong>Diagnóstico</strong>. Después podés enviar este texto al
            cliente por WhatsApp.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {showBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cambiar orden
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando...' : 'Guardar diagnóstico'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
