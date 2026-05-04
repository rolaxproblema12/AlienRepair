import { Link } from 'react-router-dom';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { useOverdueOrders } from '../hooks';
import { KIND_LABELS } from '../types';
import { routeFor } from '../utils';
import OrderStatusSelect from '@/components/orders/OrderStatusSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { openWhatsApp, buildStatusMessage } from '@/lib/whatsapp';
import { formatShortDate } from '@/lib/dates';
import { currency } from '@/lib/format';

export default function OverduePage() {
  const { data, isLoading } = useOverdueOrders();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Órdenes retrasadas</h1>
          <p className="text-muted-foreground">
            Órdenes cuya fecha estimada de entrega ya pasó y no han sido entregadas.
          </p>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data?.length ? (
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10" />
            <p>Sin órdenes retrasadas. ¡Todo al día!</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Entrega est.</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      to={routeFor(o.kind, o.id)}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      #{o.folio}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {KIND_LABELS[o.kind]}
                  </TableCell>
                  <TableCell className="text-sm">{o.customer?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {o.kind === 'reparacion'
                      ? [o.brand, o.model].filter(Boolean).join(' ') || o.device_type || '—'
                      : o.item_description ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-destructive">
                    {formatShortDate(o.estimated_delivery)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{currency(o.cost)}</TableCell>
                  <TableCell>
                    <OrderStatusSelect orderId={o.id} status={o.status} compact />
                  </TableCell>
                  <TableCell>
                    {o.customer && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="WhatsApp"
                        onClick={() =>
                          openWhatsApp(
                            o.customer!.phone,
                            buildStatusMessage(o.customer!.name, o.folio, o.status)
                          )
                        }
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
