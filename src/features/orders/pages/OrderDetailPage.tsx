import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, DollarSign, Edit, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteOrder, useOrder } from '../hooks';
import {
  useOrderBalance,
  useOrderPayments,
} from '@/features/cash/hooks';
import {
  PAYMENT_METHOD_ACCENT,
  PAYMENT_METHOD_LABELS,
} from '@/features/cash/types';
import OrderPaymentDialog from '@/features/cash/OrderPaymentDialog';
import OrderPartsSection from '@/features/parts/OrderPartsSection';
import OrderStatusSelect from '@/components/orders/OrderStatusSelect';
import PrintOrderMenu from '@/components/orders/PrintOrderMenu';
import { DEVICE_TYPE_LABELS, supportsDevicePassword } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { openWhatsApp, buildStatusMessage, formatPhoneDisplay } from '@/lib/whatsapp';
import { formatDateTime, formatDate } from '@/lib/dates';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useOrder(id);
  const del = useDeleteOrder();
  const balanceQ = useOrderBalance(id);
  const paymentsQ = useOrderPayments(id);
  const [payOpen, setPayOpen] = useState(false);

  if (order.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!order.data) {
    return <div className="p-8 text-muted-foreground">Orden no encontrada.</div>;
  }

  const o = order.data;
  const baseCost = Number(o.cost);
  const partsTotal = Number(balanceQ.data?.parts_total ?? 0);
  const totalCost = Number(balanceQ.data?.total ?? baseCost);
  const paid = Number(balanceQ.data?.paid ?? o.down_payment);
  const balance = Number(balanceQ.data?.balance ?? totalCost - Number(o.down_payment));

  return (
    <div className="space-y-6 p-8">
      <Link
        to="/reparaciones"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a reparaciones
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Orden #{o.folio}</h1>
            {o.warranty_claim_of && (
              <Link
                to={`/reparaciones/${o.warranty_claim_of}`}
                className="inline-flex items-center rounded bg-amber-500/15 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-400 hover:bg-amber-500/25"
                title="Esta OS es reclamo de garantía — click para ver la original"
              >
                ⚠️ Garantía
              </Link>
            )}
          </div>
          <p className="text-muted-foreground">Ingresó {formatDateTime(o.received_at)}</p>
        </div>
        <div className="flex gap-2">
          {o.customer && (
            <Button
              variant="outline"
              onClick={() =>
                openWhatsApp(
                  o.customer!.phone,
                  buildStatusMessage(o.customer!.name, o.folio, o.status)
                )
              }
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          )}
          <PrintOrderMenu orderId={o.id} />
          <Button asChild variant="outline">
            <Link to={`/reparaciones/${o.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          <DeleteButton
            variant="button"
            onConfirm={async () => {
              try {
                await del.mutateAsync(o.id);
                toast.success(`Orden #${o.folio} eliminada`);
                navigate('/reparaciones');
              } catch (err) {
                toast.error(getErrorMessage(err));
              }
            }}
            description={
              <>
                Se eliminará la orden <strong>#{o.folio}</strong>. Esta acción no se
                puede deshacer.
              </>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Equipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Tipo" value={o.device_type ? DEVICE_TYPE_LABELS[o.device_type] : '—'} />
            <Field label="Marca / Modelo" value={[o.brand, o.model].filter(Boolean).join(' ') || '—'} />
            {o.color && <Field label="Color" value={o.color} />}
            {supportsDevicePassword(o.device_type) && o.device_password && (
              <Field label="Contraseña / PIN / Patrón" value={o.device_password} />
            )}
            <Field label="Problema" value={o.problem ?? '—'} />
            {o.notes && <Field label="Notas" value={o.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.customer ? (
              <>
                <Link
                  to={`/clientes/${o.customer.id}`}
                  className="font-medium hover:underline"
                >
                  {o.customer.name}
                </Link>
                <p className="text-muted-foreground">
                  {formatPhoneDisplay(o.customer.phone)}
                </p>
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
            <OrderStatusSelect orderId={o.id} status={o.status} />
            {o.delivered_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Entregado: {formatDateTime(o.delivered_at)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle>Importes</CardTitle>
            {balance > 0 && (
              <Button size="sm" onClick={() => setPayOpen(true)}>
                <DollarSign className="mr-1 h-3.5 w-3.5" />
                Registrar abono
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <MoneyField label="Mano de obra" value={baseCost} />
            <MoneyField label="Piezas" value={partsTotal} />
            <MoneyField label="Total" value={totalCost} highlight />
            <MoneyField
              label="Saldo"
              value={balance}
              highlight
              tone={balance > 0 ? 'danger' : 'positive'}
            />
            <MoneyField label="Pagado" value={paid} />
            <Field
              label="Entrega estimada"
              value={o.estimated_delivery ? formatDate(o.estimated_delivery) : '—'}
            />
          </CardContent>
        </Card>

        {o.kind === 'reparacion' && (
          <div className="md:col-span-3">
            <OrderPartsSection orderId={o.id} />
          </div>
        )}

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Pagos registrados</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {paymentsQ.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !paymentsQ.data?.length ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                {Number(o.down_payment) > 0
                  ? `Anticipo previo de ${currency(o.down_payment)} (sin método registrado).`
                  : 'Sin pagos registrados.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="pr-6">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentsQ.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground">
                        {formatDateTime(p.created_at)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            PAYMENT_METHOD_ACCENT[p.payment_method],
                          )}
                        >
                          {PAYMENT_METHOD_LABELS[p.payment_method]}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono text-sm font-medium',
                          p.amount < 0 && 'text-destructive',
                        )}
                      >
                        {p.amount > 0 ? '+' : ''}
                        {currency(p.amount)}
                      </TableCell>
                      <TableCell className="pr-6 text-xs text-muted-foreground">
                        {p.notes ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        orderId={o.id}
        folio={o.folio}
        balance={balance}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  tone?: 'danger' | 'positive';
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          highlight ? 'text-lg font-semibold' : 'font-medium',
          tone === 'danger' && Number(value) > 0 && 'text-destructive',
          tone === 'positive' && Number(value) <= 0 && 'text-emerald-400',
        )}
      >
        {currency(value)}
      </p>
    </div>
  );
}
