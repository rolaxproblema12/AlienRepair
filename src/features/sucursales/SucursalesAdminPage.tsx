import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAdminSucursales, useSaveSucursal } from './hooks';
import { sucursalSchema, type SucursalInput } from './schemas';
import type { Sucursal } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';

export default function SucursalesAdminPage() {
  const { data, isLoading } = useAdminSucursales();
  const save = useSaveSucursal();
  const [editing, setEditing] = useState<Sucursal | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sucursales</h1>
          <p className="text-muted-foreground">
            Cada sucursal tiene sus propias reparaciones, inventario y ventas.
            El <span className="font-mono">code</span> (2-4 letras) se usa como prefijo de folios.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
          ) : !data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin sucursales registradas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm font-medium">{s.code}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.phone ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.active ? 'success' : 'muted'}>
                        {s.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(s.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar"
                          onClick={() => setEditing(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SucursalDialog
        open={creating}
        onOpenChange={setCreating}
        sucursal={null}
        onSave={async (input) => {
          await save.mutateAsync(input);
          toast.success('Sucursal creada');
        }}
      />
      <SucursalDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        sucursal={editing}
        onSave={async (input) => {
          if (!editing) return;
          await save.mutateAsync({ ...input, id: editing.id });
          toast.success('Sucursal actualizada');
        }}
      />
    </div>
  );
}

interface SucursalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sucursal: Sucursal | null;
  onSave: (input: SucursalInput) => Promise<void>;
}

function SucursalDialog({ open, onOpenChange, sucursal, onSave }: SucursalDialogProps) {
  const form = useForm<SucursalInput>({
    resolver: zodResolver(sucursalSchema),
    values: {
      code: sucursal?.code ?? '',
      name: sucursal?.name ?? '',
      address: sucursal?.address ?? null,
      phone: sucursal?.phone ?? null,
      active: sucursal?.active ?? true,
    },
  });

  async function submit(data: SucursalInput) {
    try {
      await onSave(data);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sucursal ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          <DialogDescription>
            El code se usa como prefijo de folios (ej: <span className="font-mono">CM-0001</span>).
            No se puede cambiar sin migrar datos históricos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="CM"
                maxLength={4}
                className="font-mono uppercase"
                {...form.register('code', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" placeholder="Casa Matriz" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Dirección (opcional)</Label>
            <Input
              id="address"
              placeholder="Av. Reforma 123, Col. Centro"
              {...form.register('address')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" placeholder="+52 55 1234 5678" {...form.register('phone')} />
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <Switch
              id="active"
              checked={form.watch('active')}
              onCheckedChange={(v) => form.setValue('active', v)}
            />
            <Label htmlFor="active" className="cursor-pointer">
              {form.watch('active') ? 'Activa' : 'Inactiva (no aparece en selector)'}
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {sucursal ? 'Guardar cambios' : 'Crear sucursal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
