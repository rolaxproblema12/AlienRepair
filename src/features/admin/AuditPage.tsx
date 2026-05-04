import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { useStatusAudit } from './hooks';
import { STATUS_LABELS, KIND_LABELS } from '@/features/orders/types';
import { routeFor } from '@/features/orders/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/dates';

export default function AuditPage() {
  const { data, isLoading } = useStatusAudit();

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Auditoría de estatus</h1>
        <p className="text-muted-foreground">
          Últimos {data?.length ?? 0} cambios de estatus de órdenes.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
              <History className="h-10 w-10" />
              <p>Sin cambios de estatus registrados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuando</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>A</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(r.changed_at)}
                    </TableCell>
                    <TableCell>
                      {r.order ? (
                        <Link
                          to={routeFor(r.order.kind, r.order_id)}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          #{r.order.folio}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.order ? KIND_LABELS[r.order.kind] : '—'}
                    </TableCell>
                    <TableCell>
                      {r.from_status ? (
                        <Badge variant="muted">
                          {STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">creada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge>
                        {STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.actor?.full_name ?? r.actor?.email ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
