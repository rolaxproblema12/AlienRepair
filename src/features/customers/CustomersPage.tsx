import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Phone,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCustomers, useDeleteCustomer } from './hooks';
import { useDebouncedValue } from '@/lib/hooks';
import CustomerFormDialog from './CustomerFormDialog';
import type { Customer } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import { formatPhoneDisplay } from '@/lib/whatsapp';
import { formatShortDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';

const ROW_LIMIT = 20;

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useCustomers(debouncedSearch);
  const del = useDeleteCustomer();

  const isSearching = debouncedSearch.trim().length > 0;
  const total = data?.length ?? 0;
  const collapsed = !isSearching && !expanded && total > ROW_LIMIT;
  const visible = collapsed ? data!.slice(0, ROW_LIMIT) : data ?? [];
  const hidden = total - visible.length;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

  async function handleDelete(c: Customer) {
    try {
      await del.mutateAsync(c.id);
      toast.success('Cliente eliminado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Base de datos de clientes del taller.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'cliente' : 'clientes'}
        </p>
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? 'Sin resultados' : 'Aún no hay clientes. Crea el primero.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead className="w-[96px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {formatPhoneDisplay(c.phone)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(c.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton
                        onConfirm={() => handleDelete(c)}
                        description={
                          <>
                            Se eliminará <strong>{c.name}</strong>. Esta acción no se puede deshacer.
                            Si el cliente tiene órdenes asociadas no podrá eliminarse.
                          </>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!isSearching && total > ROW_LIMIT && (
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

      <CustomerFormDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        customer={editing}
      />
    </div>
  );
}
