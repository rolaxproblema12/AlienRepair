import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Receipt, Search } from 'lucide-react';
import { useSales } from './hooks';
import {
  PAYMENT_METHOD_ACCENT,
  PAYMENT_METHOD_LABELS,
  type SalePaymentMethod,
} from './types';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { formatDateTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';

const ROW_LIMIT = 20;

export default function SalesHistoryPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'completada' | 'cancelada'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const debouncedFrom = useDebouncedValue(from, 400);
  const debouncedTo = useDebouncedValue(to, 400);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useSales({
    search: debouncedSearch,
    paymentMethod,
    status,
    from: debouncedFrom || undefined,
    to: debouncedTo || undefined,
  });

  const isFiltering =
    debouncedSearch.trim().length > 0 ||
    paymentMethod !== 'all' ||
    status !== 'all' ||
    !!debouncedFrom ||
    !!debouncedTo;

  useEffect(() => {
    if (isFiltering && expanded) setExpanded(false);
  }, [isFiltering, expanded]);

  const total = data?.length ?? 0;
  const collapsed = !isFiltering && !expanded && total > ROW_LIMIT;
  const visible = collapsed ? data!.slice(0, ROW_LIMIT) : data ?? [];
  const hidden = total - visible.length;

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/caja">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Historial de ventas</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'venta' : 'ventas'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Folio numérico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as SalePaymentMethod | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="tarjeta">Tarjeta</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as 'all' | 'completada' | 'cancelada')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estatus</SelectItem>
            <SelectItem value="completada">Completadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Sin ventas para mostrar.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => (
                <TableRow
                  key={s.id}
                  className={s.status === 'cancelada' ? 'opacity-50' : ''}
                >
                  <TableCell>
                    <Link
                      to={`/caja/${s.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                    >
                      VTA-{s.folio}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(s.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.customer?.name ?? 'Cliente general'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        PAYMENT_METHOD_ACCENT[s.payment_method],
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[s.payment_method]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.status === 'cancelada' ? (
                      <span className="text-destructive">Cancelada</span>
                    ) : (
                      <span className="text-emerald-400">Completada</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {currency(s.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isFiltering && total > ROW_LIMIT && (
          <div className="border-t border-border p-2">
            {collapsed ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronDown className="h-3 w-3" />
                Ver {hidden} más
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronUp className="h-3 w-3" />
                Mostrar menos
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
