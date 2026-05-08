import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import {
  useSucursalSettingsMap,
  useUpsertSucursalSettings,
} from '../sucursalConfig/hooks';
import {
  whatsappTemplatesSchema,
  ORDER_STATUS_KEYS,
  STATUS_TEMPLATE_LABELS,
  type WhatsappTemplatesInput,
  type OrderStatusKey,
} from '../sucursalConfig/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { Field } from './Field';

export function WhatsappTemplatesTab({ sucursalId }: { sucursalId: string }) {
  const settingsQ = useSucursalSettingsMap(sucursalId);
  const upsert = useUpsertSucursalSettings();

  const { register, handleSubmit, reset, formState: { isDirty } } =
    useForm<WhatsappTemplatesInput>({
      resolver: zodResolver(whatsappTemplatesSchema),
      defaultValues: { pendiente: '', diagnostico: '', en_espera: '', reparando: '', listo: '', entregado: '' },
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

/**
 * Toggle separado que persiste el setting `whatsapp_auto_notify` ('1' o '0').
 * Cuando está ON, cada cambio de status dispara un toast con acción
 * "Enviar WhatsApp" (gestionado por useUpdateOrderStatusWithNotify).
 */
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
