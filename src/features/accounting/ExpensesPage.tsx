import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Edit2, Plus, Receipt, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInfiniteExpenses, useDeleteExpense } from './hooks';
import { EXPENSE_KIND_LABELS, type ExpenseWithOrder } from './types';
import ExpenseFormDialog from './ExpenseFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { firstOfMonthIso, formatShortDate, todayIso } from '@/lib/dates';
import { currency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';

function orderRoute(kind: 'reparacion' | 'encargo' | 'accesorio', id: string) {
  if (kind === 'reparacion') return `/reparaciones/${id}`;
  if (kind === 'encargo') return `/encargos/${id}`;
  return `/accesorios/${id}`;
}

export default function ExpensesPage() {
  const [kindFilter, setKindFilter] = useState<'all' | 'refaccion' | 'general'>('all');
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithOrder | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ExpenseWithOrder | null>(null);

  const expensesQ = useInfiniteExpenses({ kind: kindFilter, from, to });
  const del = useDeleteExpense();
  const isLoading = expensesQ.isLoading;
  // flatMap todas las páginas — render como array plano + botón "Cargar más".
  const data = expensesQ.data?.pages.flatMap((p) => p.rows) ?? [];

  // Total parcial: solo de las páginas cargadas. Si el usuario quiere el
  // total real del rango debe cargar todas las páginas (botón "Cargar más").
  const total = data.reduce((acc, e) => acc + Number(e.amount), 0);

  async function confirmDelete() {
    if (!deleteCandidate) return;
    try {
      await del.mutateAsync(deleteCandidate.id);
      toast.success('Gasto eliminado');
      setDeleteCandidate(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gastos</h1>
          <p className="text-muted-foreground">
            Registro de refacciones y gastos generales.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo gasto
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={kindFilter}
            onValueChange={(v) => setKindFilter(v as typeof kindFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(EXPENSE_KIND_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <div className="ml-auto rounded-md border border-border px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {expensesQ.hasNextPage ? 'Total parcial: ' : 'Total en rango: '}
          </span>
          <span className="font-semibold">{currency(total)}</span>
          {expensesQ.hasNextPage && (
            <span className="ml-1 text-xs text-amber-400">
              (carga más páginas para el total real)
            </span>
          )}
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data.length ? (
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
            <Receipt className="h-10 w-10" />
            <p>Sin gastos en el rango seleccionado.</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{formatShortDate(e.spent_at)}</TableCell>
                  <TableCell>
                    <Badge variant={e.kind === 'refaccion' ? 'warning' : 'muted'}>
                      {EXPENSE_KIND_LABELS[e.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.description}</TableCell>
                  <TableCell className="text-sm">
                    {e.order ? (
                      <Link
                        to={orderRoute(e.order.kind, e.order.id)}
                        className="font-mono hover:underline"
                      >
                        #{e.order.folio}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {currency(e.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(e);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteCandidate(e)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {expensesQ.hasNextPage && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => expensesQ.fetchNextPage()}
              disabled={expensesQ.isFetchingNextPage}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <ChevronDown className="h-3 w-3" />
              {expensesQ.isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
            </button>
          </div>
        )}
      </Card>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editing}
      />

      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar gasto</DialogTitle>
            <DialogDescription>
              {deleteCandidate ? (
                <>
                  ¿Eliminar el gasto "{deleteCandidate.description}" por{' '}
                  <strong>{currency(deleteCandidate.amount)}</strong>? Esta acción no
                  se puede deshacer.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteCandidate(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={del.isPending}
            >
              {del.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
