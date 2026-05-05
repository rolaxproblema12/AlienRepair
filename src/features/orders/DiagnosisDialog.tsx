import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSaveDiagnosis } from './hooks';
import { diagnosisSchema, type DiagnosisInput } from './schemas';
import type { OrderWithCustomer } from './types';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useSucursalSettingsMap } from '@/features/admin/sucursalConfig/hooks';
import { buildDiagnosisMessage, openWhatsApp } from '@/lib/whatsapp';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: OrderWithCustomer;
}

export default function DiagnosisDialog({ open, onOpenChange, order }: Props) {
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
    if (open) reset({ diagnosis: order.diagnosis ?? '' });
  }, [open, order.diagnosis, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        diagnosis: values.diagnosis,
        currentStatus: order.status,
      });
      onOpenChange(false);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
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
              Al guardar, si la OS está en <strong>Pendiente</strong> pasa
              automáticamente a <strong>Diagnóstico</strong>. Después podés enviar
              este texto al cliente por WhatsApp.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando...' : 'Guardar diagnóstico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
