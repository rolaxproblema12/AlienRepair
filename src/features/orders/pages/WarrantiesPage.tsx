import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Plus, Search, ShieldAlert } from 'lucide-react';
import { useWarrantyOrders } from '../hooks';
import OrderStatusSelect from '@/components/orders/OrderStatusSelect';
import CustomerCombobox from '@/components/customers/CustomerCombobox';
import { useCustomerWarrantyOrders } from '@/features/customers/hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { useDebouncedValue } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'activas' | 'entregadas';

export default function WarrantiesPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useWarrantyOrders({
    search: debouncedSearch,
    status,
  });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <BadgeCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Garantías</h1>
            <p className="text-muted-foreground">
              Reparaciones que reclaman cobertura de una OS entregada anteriormente.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva garantía
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="activas">Activas (sin entregar)</SelectItem>
            <SelectItem value="entregadas">Entregadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data?.length ? (
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <ShieldAlert className="h-10 w-10" />
            <p>Sin garantías para mostrar.</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear la primera
            </Button>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>OS original</TableHead>
                <TableHead>Recibido</TableHead>
                <TableHead>Estatus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      to={`/reparaciones/${o.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      #{o.folio}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{o.customer?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    <span className="line-clamp-1">
                      {[o.brand, o.model].filter(Boolean).join(' ') || o.device_type || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.original ? (
                      <Link
                        to={`/reparaciones/${o.original.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        #{o.original.folio}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(o.received_at)}
                  </TableCell>
                  <TableCell>
                    <OrderStatusSelect orderId={o.id} status={o.status} compact />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewWarrantyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

interface NewWarrantyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function NewWarrantyDialog({ open, onOpenChange }: NewWarrantyDialogProps) {
  const navigate = useNavigate();
  const { current: sucursal } = useCurrentSucursal();
  const [customerId, setCustomerId] = useState<string | null>(null);
  // Fallback 0 (no 30) para que cuando sucursal aún no cargó el query de
  // eligibles esté disabled (`enabled: warrantyDays > 0` en useCustomerWarrantyOrders).
  // Evita refetch al hidratar la sucursal real.
  const warrantyDays = sucursal?.warranty_days ?? 0;
  const eligible = useCustomerWarrantyOrders(customerId ?? undefined, warrantyDays);

  // Reset al cerrar el dialog para no mostrar selección stale al reabrir.
  function handleOpenChange(next: boolean) {
    if (!next) setCustomerId(null);
    onOpenChange(next);
  }

  function handlePick(
    orderId: string,
    brand: string | null,
    model: string | null,
    deviceType: string | null,
  ) {
    const params = new URLSearchParams();
    if (customerId) params.set('cliente', customerId);
    params.set('warranty', orderId);
    if (brand) params.set('brand', brand);
    if (model) params.set('model', model);
    if (deviceType) params.set('device', deviceType);
    onOpenChange(false);
    setCustomerId(null);
    navigate(`/reparaciones/nueva?${params.toString()}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva garantía</DialogTitle>
          <DialogDescription>
            Selecciona el cliente y la reparación entregada que vas a cubrir. La nueva OS
            arranca con costo $0 (editable si aplica un cargo extra).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <CustomerCombobox value={customerId} onChange={setCustomerId} />
          </div>

          {customerId && warrantyDays === 0 && (
            <p className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
              Esta sucursal no tiene período de garantía configurado. Configurá{' '}
              <code className="rounded bg-muted px-1 text-xs">warranty_days</code> en
              Configuración → Datos del shop antes de cubrir garantías.
            </p>
          )}

          {customerId && warrantyDays > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Reparaciones entregadas elegibles (últimos {warrantyDays} días)
              </label>
              {eligible.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : !eligible.data?.length ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Este cliente no tiene reparaciones entregadas en los últimos{' '}
                  {warrantyDays} días.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {eligible.data.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(o.id, o.brand, o.model, o.device_type)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition',
                          'hover:border-primary/40 hover:bg-secondary',
                        )}
                      >
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-mono text-xs font-medium text-primary">
                              #{o.folio}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              entregado {formatShortDate(o.delivered_at)}
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-sm">
                            {[o.brand, o.model].filter(Boolean).join(' ') || '—'}
                          </div>
                          {o.problem && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {o.problem}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
