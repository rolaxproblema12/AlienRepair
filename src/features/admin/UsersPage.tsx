import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Building2, Check } from 'lucide-react';
import { useAdminProfiles, useUpdateProfile } from './hooks';
import type { UserRole } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useAdminSucursales,
  useAllUserSucursalCounts,
  useUserSucursalAssignments,
  useAssignUserToSucursal,
  useUnassignUserFromSucursal,
} from '@/features/sucursales/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { formatDateTime } from '@/lib/dates';
import { getErrorMessage } from '@/lib/errors';

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

export default function UsersPage() {
  const { profile } = useAuth();
  const { data, isLoading } = useAdminProfiles();
  const { data: sucursalCounts } = useAllUserSucursalCounts();
  const update = useUpdateProfile();
  const [assignTarget, setAssignTarget] = useState<{ id: string; email: string | null } | null>(null);
  // Reemplaza window.confirm() (modal del SO, feo) por un Dialog inline
  // de shadcn. Una sola pieza de state cubre los dos prompts del page.
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  function getSucursalCount(userId: string) {
    return sucursalCounts?.get(userId) ?? 0;
  }

  async function doToggleActive(id: string, active: boolean) {
    try {
      await update.mutateAsync({ id, active });
      toast.success(active ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function toggleActive(id: string, active: boolean) {
    if (id === profile?.id && !active) {
      toast.error('No puedes desactivarte a ti mismo.');
      return;
    }
    if (active) {
      const target = data?.find((u) => u.id === id);
      const isOperator = target?.role !== 'admin';
      if (isOperator && getSucursalCount(id) === 0) {
        setConfirm({
          title: 'Activar sin sucursales',
          description:
            'Este usuario no tiene sucursales asignadas. RLS le bloqueará todo acceso a datos hasta que asignes al menos una sucursal. ¿Activar de todos modos?',
          confirmLabel: 'Activar',
          onConfirm: () => doToggleActive(id, active),
        });
        return;
      }
    }
    await doToggleActive(id, active);
  }

  async function doChangeRole(id: string, role: UserRole) {
    try {
      await update.mutateAsync({ id, role });
      toast.success('Rol actualizado');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function changeRole(id: string, role: UserRole) {
    if (id === profile?.id && role !== 'admin') {
      toast.error('No puedes quitarte a ti mismo el rol de admin.');
      return;
    }
    if (role !== 'admin' && getSucursalCount(id) === 0) {
      setConfirm({
        title: 'Cambiar rol sin sucursales',
        description:
          'Al quitar el rol de admin, este usuario solo verá datos de sus sucursales asignadas — y no tiene ninguna. Quedará sin acceso real. ¿Cambiar el rol de todos modos?',
        confirmLabel: 'Cambiar rol',
        onConfirm: () => doChangeRole(id, role),
      });
      return;
    }
    await doChangeRole(id, role);
  }

  async function saveCommissionRate(id: string, pct: number) {
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Comisión inválida (0-100%)');
      return;
    }
    try {
      await update.mutateAsync({ id, commission_rate: pct / 100 });
      toast.success(`Comisión actualizada: ${pct}%`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-muted-foreground">
          Activa, desactiva, cambia el rol o asigna sucursales a los usuarios registrados.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
          ) : !data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin usuarios registrados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Comisión %</TableHead>
                  <TableHead>Sucursales</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm">
                      {u.email ?? '—'}
                      {u.id === profile?.id && (
                        <Badge className="ml-2" variant="muted">
                          tú
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{u.full_name ?? '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => changeRole(u.id, v as UserRole)}
                        disabled={u.id === profile?.id}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usuario">Usuario</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.active}
                        onCheckedChange={(v) => toggleActive(u.id, v)}
                        disabled={u.id === profile?.id}
                      />
                    </TableCell>
                    <TableCell>
                      <CommissionInput
                        userId={u.id}
                        initialPct={Number(u.commission_rate ?? 0) * 100}
                        onSave={saveCommissionRate}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAssignTarget({ id: u.id, email: u.email })}
                        >
                          <Building2 className="mr-1.5 h-3.5 w-3.5" />
                          Asignar
                        </Button>
                        <SucursalCountBadge
                          count={getSucursalCount(u.id)}
                          isAdmin={u.role === 'admin'}
                          active={u.active}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(u.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {assignTarget && (
        <SucursalAssignDialog
          userId={assignTarget.id}
          userEmail={assignTarget.email}
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const fn = confirm?.onConfirm;
                setConfirm(null);
                if (fn) await fn();
              }}
            >
              {confirm?.confirmLabel ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SucursalCountBadge({
  count,
  isAdmin,
  active,
}: {
  count: number;
  isAdmin: boolean;
  active: boolean;
}) {
  if (isAdmin) {
    return (
      <Badge variant="muted" className="text-[10px]">
        admin · todas
      </Badge>
    );
  }
  if (count === 0 && active) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        Sin acceso
      </Badge>
    );
  }
  return (
    <Badge variant={count === 0 ? 'muted' : 'success'} className="text-[10px]">
      {count}
    </Badge>
  );
}

// Input controlado que persiste con onBlur (no en cada keystroke).
function CommissionInput({
  userId,
  initialPct,
  onSave,
}: {
  userId: string;
  initialPct: number;
  onSave: (id: string, pct: number) => Promise<void>;
}) {
  const [val, setVal] = useState(String(initialPct));
  return (
    <Input
      type="number"
      min={0}
      max={100}
      step={0.5}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const pct = Number(val);
        if (Math.abs(pct - initialPct) > 0.001) {
          onSave(userId, pct);
        }
      }}
      className="h-8 w-20 text-xs"
    />
  );
}

function SucursalAssignDialog({
  userId,
  userEmail,
  open,
  onClose,
}: {
  userId: string;
  userEmail: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: allSucursales = [], isLoading: loadingS } = useAdminSucursales();
  const { data: assignments = [], isLoading: loadingA } = useUserSucursalAssignments(userId);
  const assign = useAssignUserToSucursal();
  const unassign = useUnassignUserFromSucursal();

  const assignedSet = useMemo(
    () => new Set(assignments.map((a) => a.sucursal_id)),
    [assignments],
  );

  async function toggle(sucursalId: string, currentlyAssigned: boolean) {
    try {
      if (currentlyAssigned) {
        await unassign.mutateAsync({ userId, sucursalId });
      } else {
        await assign.mutateAsync({ userId, sucursalId });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sucursales asignadas</DialogTitle>
          <DialogDescription>
            {userEmail ?? 'Usuario'} podrá operar en las sucursales que actives. Admin tiene
            acceso a todas independientemente de las asignaciones.
          </DialogDescription>
        </DialogHeader>

        {loadingS || loadingA ? (
          <div className="py-4 text-sm text-muted-foreground">Cargando...</div>
        ) : !allSucursales.length ? (
          <div className="py-4 text-sm text-muted-foreground">
            No hay sucursales en el sistema todavía.
          </div>
        ) : (
          <div className="space-y-2">
            {allSucursales.map((s) => {
              const isAssigned = assignedSet.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id, isAssigned)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    {isAssigned ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.code}</div>
                  </div>
                  <Badge variant={isAssigned ? 'success' : 'muted'}>
                    {isAssigned ? 'Asignada' : 'Sin asignar'}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
