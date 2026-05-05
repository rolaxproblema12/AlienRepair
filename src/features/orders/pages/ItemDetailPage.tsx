import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteOrder, useOrder } from '../hooks';
import OrderStatusSelect from '@/components/orders/OrderStatusSelect';
import PrintOrderMenu from '@/components/orders/PrintOrderMenu';
import { DEVICE_TYPE_LABELS, supportsDevicePassword, type OrderKind } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import { openWhatsApp, buildStatusMessage, formatPhoneDisplay } from '@/lib/whatsapp';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useSucursalSettingsMap } from '@/features/admin/sucursalConfig/hooks';
import { formatDateTime, formatDate } from '@/lib/dates';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  kind: Extract<OrderKind, 'encargo' | 'accesorio'>;
}

const COPY = {
  encargo: { title: 'Encargo', route: '/encargos' },
  accesorio: { title: 'Accesorio', route: '/accesorios' },
} as const;

export default function ItemDetailPage({ kind }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useOrder(id);
  const del = useDeleteOrder();
  const copy = COPY[kind];
  const { current: sucursal } = useCurrentSucursal();
  const { map: settingsMap } = useSucursalSettingsMap(sucursal?.id);

  if (order.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!order.data) {
    return <div className="p-8 text-muted-foreground">No encontrado.</div>;
  }

  const o = order.data;
  const saldo = Number(o.cost) - Number(o.down_payment);

  return (
    <div className="space-y-6 p-8">
      <Link
        to={copy.route}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {copy.title} #{o.folio}
          </h1>
          <p className="text-muted-foreground">Ingresó {formatDateTime(o.received_at)}</p>
        </div>
        <div className="flex gap-2">
          {o.customer && (
            <Button
              variant="outline"
              onClick={() =>
                openWhatsApp(
                  o.customer!.phone,
                  buildStatusMessage(o.customer!.name, o.folio, o.status, {
                    shopName: sucursal?.name,
                    template: settingsMap.get(`msg_status_${o.status}`),
                  })
                )
              }
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          )}
          <PrintOrderMenu orderId={o.id} />
          <Button asChild variant="outline">
            <Link to={`${copy.route}/${o.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <DeleteButton
            variant="button"
            onConfirm={async () => {
              try {
                await del.mutateAsync(o.id);
                toast.success(`#${o.folio} eliminado`);
                navigate(copy.route);
              } catch (err) {
                toast.error(getErrorMessage(err));
              }
            }}
            description={
              <>
                Se eliminará {copy.title.toLowerCase()} <strong>#{o.folio}</strong>.
                Esta acción no se puede deshacer.
              </>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Artículo</p>
              <p className="whitespace-pre-wrap">{o.item_description ?? '—'}</p>
            </div>
            {o.device_type && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dispositivo</p>
                <p>{DEVICE_TYPE_LABELS[o.device_type]}</p>
              </div>
            )}
            {supportsDevicePassword(o.device_type) && o.device_password && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contraseña / PIN / Patrón
                </p>
                <p>{o.device_password}</p>
              </div>
            )}
            {o.notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notas</p>
                <p className="whitespace-pre-wrap">{o.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.customer ? (
              <>
                <Link to={`/clientes/${o.customer.id}`} className="font-medium hover:underline">
                  {o.customer.name}
                </Link>
                <p className="text-muted-foreground">{formatPhoneDisplay(o.customer.phone)}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Sin cliente</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatus</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusSelect orderId={o.id} status={o.status} kind={kind} />
            {o.delivered_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Entregado: {formatDateTime(o.delivered_at)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Importes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Costo</p>
              <p className="font-medium">{currency(o.cost)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Anticipo</p>
              <p className="font-medium">{currency(o.down_payment)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo</p>
              <p className="text-lg font-semibold">{currency(saldo)}</p>
            </div>
            <div className="col-span-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Entrega</p>
              <p>{o.estimated_delivery ? formatDate(o.estimated_delivery) : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
