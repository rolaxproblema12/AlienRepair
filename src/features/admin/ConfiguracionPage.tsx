import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save, Building2, MessageCircle, Tag, Download } from 'lucide-react';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import {
  useSucursalConfig,
  useUpdateSucursalConfig,
  useSucursalSettingsMap,
  useUpsertSucursalSettings,
} from './sucursalConfig/hooks';
import {
  sucursalConfigSchema,
  whatsappTemplatesSchema,
  ORDER_STATUS_KEYS,
  STATUS_TEMPLATE_LABELS,
  type SucursalConfigInput,
  type WhatsappTemplatesInput,
  type OrderStatusKey,
} from './sucursalConfig/schemas';
import { useMarkupSetting, useUpdateMarkupSetting } from '@/features/catalog/hooks';
import { useBackupExport } from './backup/hooks';
import {
  multiplierToMarkupPct,
  markupPctToMultiplier,
  DEFAULT_MARKUP_MULTIPLIER,
} from '@/features/catalog/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

type Tab = 'shop' | 'whatsapp' | 'catalog';

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('shop');
  const { current } = useCurrentSucursal();

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes del shop, plantillas de mensajes y catálogo.
          {current && <> Sucursal actual: <strong>{current.name}</strong>.</>}
        </p>
      </div>

      {!current ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecciona una sucursal para configurarla.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <TabButton active={tab === 'shop'} onClick={() => setTab('shop')} icon={<Building2 className="h-3.5 w-3.5" />}>
              Datos del shop
            </TabButton>
            <TabButton active={tab === 'whatsapp'} onClick={() => setTab('whatsapp')} icon={<MessageCircle className="h-3.5 w-3.5" />}>
              Plantillas WhatsApp
            </TabButton>
            <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')} icon={<Tag className="h-3.5 w-3.5" />}>
              Catálogo
            </TabButton>
          </div>

          {tab === 'shop' && <ShopDataTab sucursalId={current.id} />}
          {tab === 'whatsapp' && <WhatsappTemplatesTab sucursalId={current.id} />}
          {tab === 'catalog' && <CatalogTab />}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// =====================================================
// Tab 1 — Datos del shop
// =====================================================
function ShopDataTab({ sucursalId }: { sucursalId: string }) {
  const configQ = useSucursalConfig(sucursalId);
  const update = useUpdateSucursalConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SucursalConfigInput>({
    resolver: zodResolver(sucursalConfigSchema),
    defaultValues: {
      name: '',
      address: null,
      phone: null,
      rfc: null,
      email: null,
      web: null,
      logo_url: null,
      warranty_message: null,
      warranty_days: 30,
    },
  });

  // Hidratar el form cuando llega data del server.
  useEffect(() => {
    if (configQ.data) {
      reset({
        name: configQ.data.name,
        address: configQ.data.address ?? '',
        phone: configQ.data.phone ?? '',
        rfc: configQ.data.rfc ?? '',
        email: configQ.data.email ?? '',
        web: configQ.data.web ?? '',
        logo_url: configQ.data.logo_url ?? '',
        warranty_message: configQ.data.warranty_message ?? '',
        warranty_days: configQ.data.warranty_days ?? 30,
      } as SucursalConfigInput);
    }
  }, [configQ.data, reset]);

  const logoUrl = watch('logo_url');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ id: sucursalId, values });
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  if (configQ.isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Cargando…</CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" error={errors.name?.message}>
              <Input {...register('name')} />
            </Field>
            <Field label="RFC / RUT / CUIT" error={errors.rfc?.message}>
              <Input {...register('rfc')} placeholder="Opcional" />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input {...register('phone')} placeholder="55 1234 5678" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" {...register('email')} placeholder="contacto@..." />
            </Field>
            <Field label="Web" error={errors.web?.message}>
              <Input {...register('web')} placeholder="https://..." />
            </Field>
            <Field label="Logo (URL)" error={errors.logo_url?.message}>
              <Input {...register('logo_url')} placeholder="https://..." />
            </Field>
          </div>
          <Field label="Dirección" error={errors.address?.message}>
            <Input {...register('address')} placeholder="Calle, número, ciudad" />
          </Field>
          {logoUrl && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">Vista previa del logo:</p>
              <img
                src={logoUrl}
                alt="Logo"
                className="h-16 max-w-[200px] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garantía</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Días de garantía sobre reparaciones entregadas"
            error={errors.warranty_days?.message}
          >
            <Input
              type="number"
              min={0}
              max={730}
              step={1}
              {...register('warranty_days', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Cuando se cree una nueva OS para un cliente que tenga una OS
              entregada hace menos de este número de días, el sistema avisa
              al operador para que pueda marcarla como reclamo de garantía.
            </p>
          </Field>
          <Field
            label="Texto que aparece al pie de los tickets impresos (orden, recibo, venta)"
            error={errors.warranty_message?.message}
          >
            <Textarea
              rows={3}
              {...register('warranty_message')}
              placeholder="Ej: Garantía de 30 días sobre la mano de obra. No nos hacemos responsables por equipos no recogidos en 60 días."
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || update.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <BackupCard sucursalId={sucursalId} />
    </form>
  );
}

// Card de "Backup de datos" — botón que descarga un JSON con todas las
// tablas transaccionales y de catálogo de la sucursal. No hay restore
// desde la app (ver backup/hooks.ts).
function BackupCard({ sucursalId }: { sucursalId: string }) {
  const backup = useBackupExport();

  async function handleExport() {
    try {
      const result = await backup.mutateAsync(sucursalId);
      const totalRows = Object.values(result.bundle.counts).reduce(
        (s, n) => s + n,
        0,
      );
      if (result.errors.length) {
        toast.warning(
          `Backup descargado con ${result.errors.length} tablas con errores`,
          { description: result.errors.join('\n') },
        );
      } else {
        toast.success(
          `Backup descargado · ${totalRows.toLocaleString('es-MX')} filas en ${
            Object.keys(result.bundle.counts).length
          } tablas`,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup de datos</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p>
            Descarga un archivo JSON con todos los datos de esta sucursal:
            clientes, órdenes, productos, piezas, ventas, gastos, sesiones de
            caja y settings.
          </p>
          <p className="text-xs text-muted-foreground">
            Sirve como respaldo portable. La restauración no está soportada
            desde la app — usa el backup nativo de Supabase para recovery.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={backup.isPending}
        >
          <Download className="mr-2 h-4 w-4" />
          {backup.isPending ? 'Descargando…' : 'Descargar backup'}
        </Button>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Tab 2 — Plantillas WhatsApp
// =====================================================
function WhatsappTemplatesTab({ sucursalId }: { sucursalId: string }) {
  const settingsQ = useSucursalSettingsMap(sucursalId);
  const upsert = useUpsertSucursalSettings();

  const { register, handleSubmit, reset, formState: { isDirty } } =
    useForm<WhatsappTemplatesInput>({
      resolver: zodResolver(whatsappTemplatesSchema),
      defaultValues: { pendiente: '', en_espera: '', reparando: '', listo: '', entregado: '' },
    });

  useEffect(() => {
    if (!settingsQ.isLoading) {
      reset({
        pendiente: settingsQ.map.get('msg_status_pendiente') ?? '',
        diagnostico: settingsQ.map.get('msg_status_diagnostico') ?? '',
        en_espera: settingsQ.map.get('msg_status_en_espera') ?? '',
        reparando: settingsQ.map.get('msg_status_reparando') ?? '',
        listo: settingsQ.map.get('msg_status_listo') ?? '',
        entregado: settingsQ.map.get('msg_status_entregado') ?? '',
      });
    }
  }, [settingsQ.isLoading, settingsQ.map, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const entries = ORDER_STATUS_KEYS.map((k) => ({
      key: `msg_status_${k}`,
      value: (values[k] ?? '').trim(),
    }));
    try {
      await upsert.mutateAsync({ sucursalId, entries });
      toast.success('Plantillas guardadas');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <div className="space-y-4">
      <AutoNotifyToggle sucursalId={sucursalId} settingsMap={settingsQ.map} />
      <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plantillas de mensajes WhatsApp</CardTitle>
          <p className="text-xs text-muted-foreground">
            Variables disponibles: <code className="rounded bg-muted px-1">{'{customer}'}</code>{' '}
            (nombre del cliente) y <code className="rounded bg-muted px-1">{'{folio}'}</code> (folio
            de la orden). Si dejas un campo vacío, se usa el mensaje por defecto.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {ORDER_STATUS_KEYS.map((status) => (
            <Field key={status} label={STATUS_TEMPLATE_LABELS[status as OrderStatusKey]}>
              <Textarea rows={2} {...register(status)} placeholder={defaultTemplateFor(status)} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || upsert.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {upsert.isPending ? 'Guardando…' : 'Guardar plantillas'}
        </Button>
      </div>
      </form>
    </div>
  );
}

// Toggle separado que persiste el setting `whatsapp_auto_notify` ('1' o '0').
// Cuando está ON, cada cambio de status dispara un toast con acción
// "Enviar WhatsApp" (gestionado por useUpdateOrderStatusWithNotify).
function AutoNotifyToggle({
  sucursalId,
  settingsMap,
}: {
  sucursalId: string;
  settingsMap: Map<string, string>;
}) {
  const upsert = useUpsertSucursalSettings();
  const enabled = settingsMap.get('whatsapp_auto_notify') !== '0';

  async function handleToggle(next: boolean) {
    try {
      await upsert.mutateAsync({
        sucursalId,
        entries: [{ key: 'whatsapp_auto_notify', value: next ? '1' : '0' }],
      });
      toast.success(next ? 'Notificación automática activada' : 'Notificación automática apagada');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificación automática al cambiar estatus</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm">
            Cuando un operador cambia el estatus de una OS, mostrar un toast
            con un botón para enviar WhatsApp al cliente.
          </p>
          <p className="text-xs text-muted-foreground">
            Solo se dispara si la OS tiene cliente con teléfono. El operador
            decide si enviar — no se manda automático para evitar spam.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={upsert.isPending} />
      </CardContent>
    </Card>
  );
}

function defaultTemplateFor(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'Hola {customer}, recibimos tu equipo (orden #{folio}) y pronto iniciaremos el diagnóstico.',
    diagnostico: 'Hola {customer}, ya hicimos el diagnóstico de tu equipo (orden #{folio}). Te lo compartimos por aparte.',
    en_espera: 'Hola {customer}, tu equipo (orden #{folio}) está en espera (pendiente de refacción o confirmación).',
    reparando: 'Hola {customer}, ya comenzamos la reparación de tu equipo (orden #{folio}).',
    listo: '¡Hola {customer}! Tu equipo (orden #{folio}) ya está listo para recoger 🎉',
    entregado: 'Hola {customer}, gracias por tu confianza. Cualquier duda con tu orden #{folio}, avísanos.',
  };
  return map[status] ?? '';
}

// =====================================================
// Tab 3 — Catálogo
// =====================================================
function CatalogTab() {
  const markupQ = useMarkupSetting();
  const update = useUpdateMarkupSetting();
  const [markupInput, setMarkupInput] = useState<string>('');

  useEffect(() => {
    if (markupQ.data != null && markupInput === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarkupInput(String(multiplierToMarkupPct(markupQ.data)));
    }
  }, [markupQ.data, markupInput]);

  const currentMultiplier = markupQ.data ?? DEFAULT_MARKUP_MULTIPLIER;
  const previewSale =
    Math.round(100 * markupPctToMultiplier(Number(markupInput || 0)) * 100) / 100;

  async function handleSave() {
    const pct = Number(markupInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
      toast.error('Margen inválido (0 a 1000)');
      return;
    }
    try {
      await update.mutateAsync(markupPctToMultiplier(pct));
      toast.success(`Margen guardado: ${pct}%`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margen sugerido del catálogo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Multiplicador aplicado al precio de compra para sugerir el precio de venta. Por
          ejemplo, 150% significa que una pieza de $100 se sugiere a $250. Setting global del
          sistema (no per-sucursal). Valor actual: {multiplierToMarkupPct(currentMultiplier)}%.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Margen %">
            <Input
              type="number"
              min={0}
              max={1000}
              step={5}
              value={markupInput}
              onChange={(e) => setMarkupInput(e.target.value)}
            />
          </Field>
          <Field label="Vista previa">
            <div className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-mono">
              $100 → ${previewSale.toFixed(2)}
            </div>
          </Field>
        </div>
        <Button onClick={handleSave} disabled={update.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {update.isPending ? 'Guardando…' : 'Guardar margen'}
        </Button>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Helper compartido
// =====================================================
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
