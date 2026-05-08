import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import {
  useSucursalConfig,
  useUpdateSucursalConfig,
} from '../sucursalConfig/hooks';
import {
  sucursalConfigSchema,
  type SucursalConfigInput,
} from '../sucursalConfig/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { Field } from './Field';
import { BackupCard } from './BackupCard';

export function ShopDataTab({ sucursalId }: { sucursalId: string }) {
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
