import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, MessageCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomer, useDeleteCustomer } from './hooks';
import { useCustomerOrders } from '@/features/orders/hooks';
import CustomerFormDialog from './CustomerFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import { formatPhoneDisplay, openWhatsApp } from '@/lib/whatsapp';
import { formatDateTime, formatShortDate } from '@/lib/dates';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customer = useCustomer(id);
  const orders = useCustomerOrders(id);
  const [editOpen, setEditOpen] = useState(false);
  const del = useDeleteCustomer();

  if (customer.isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!customer.data) {
    return <div className="p-8 text-muted-foreground">Cliente no encontrado.</div>;
  }

  const c = customer.data;

  return (
    <div className="space-y-6 p-8">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-muted-foreground">
            Tel: {formatPhoneDisplay(c.phone)}
            {c.email ? ` · ${c.email}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            Registrado {formatDateTime(c.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              openWhatsApp(c.phone, `Hola ${c.name}, te escribimos de AlienTechnology.`)
            }
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <DeleteButton
            variant="button"
            disabled={(orders.data?.length ?? 0) > 0}
            disabledReason="No se puede eliminar: el cliente tiene órdenes"
            onConfirm={async () => {
              try {
                await del.mutateAsync(c.id);
                toast.success('Cliente eliminado');
                navigate('/clientes');
              } catch (err) {
                toast.error(getErrorMessage(err));
              }
            }}
            description={
              <>
                Se eliminará <strong>{c.name}</strong>. Esta acción no se puede deshacer.
              </>
            }
          />
          <Button asChild>
            <Link to={`/reparaciones/nueva?cliente=${c.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden
            </Link>
          </Button>
        </div>
      </div>

      {c.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {c.notes}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historial de órdenes ({orders.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : !orders.data?.length ? (
            <p className="text-sm text-muted-foreground">Sin órdenes previas.</p>
          ) : (
            <div className="divide-y divide-border">
              {orders.data.map((o) => (
                <Link
                  key={o.id}
                  to={`/reparaciones/${o.id}`}
                  className="flex items-center justify-between py-3 transition hover:bg-secondary/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">#{o.folio}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[o.brand, o.model].filter(Boolean).join(' ')} — {o.kind}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{currency(o.cost)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(o.received_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={c} />
    </div>
  );
}
