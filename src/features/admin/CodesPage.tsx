import { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAccessCodes,
  useGenerateAccessCode,
  useDeleteAccessCode,
  type AccessCode,
} from './hooks';
import type { UserRole } from '@/features/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { log } from '@/lib/logger';

function statusOf(c: AccessCode): { label: string; tone: 'success' | 'muted' | 'warning' } {
  if (c.used_at) return { label: 'Usado', tone: 'muted' };
  if (c.expires_at && new Date(c.expires_at) < new Date())
    return { label: 'Expirado', tone: 'warning' };
  return { label: 'Activo', tone: 'success' };
}

export default function CodesPage() {
  const { data, isLoading } = useAccessCodes();
  const gen = useGenerateAccessCode();
  const del = useDeleteAccessCode();

  const [role, setRole] = useState<UserRole>('usuario');
  const [expires, setExpires] = useState<string>('');
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Código copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function generate() {
    try {
      const expiresAt = expires
        ? new Date(`${expires}T23:59:59`).toISOString()
        : null;
      const created = await gen.mutateAsync({ role, expiresAt });
      await copy(created.code);
      toast.success(`Código ${created.code} generado`);
    } catch (err) {
      log.error('admin', 'generate access code error', err);
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    try {
      await del.mutateAsync(deleteCandidate);
      toast.success('Código eliminado');
      setDeleteCandidate(null);
    } catch (err) {
      log.error('admin', 'delete access code error', err);
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Códigos de acceso</h1>
        <p className="text-muted-foreground">
          Genera códigos de un solo uso para activar cuentas nuevas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar código</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Rol a otorgar</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usuario">Usuario</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expira (opcional)</Label>
            <Input
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button onClick={generate} disabled={gen.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            {gen.isPending ? 'Generando...' : 'Generar y copiar'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando...</div>
          ) : !data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin códigos generados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => {
                  const st = statusOf(c);
                  return (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono text-sm font-medium">
                        {c.code}
                      </TableCell>
                      <TableCell className="text-sm">{c.role_to_grant}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(c.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.expires_at ? formatDateTime(c.expires_at) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.tone}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copiar"
                            onClick={() => copy(c.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!c.used_at && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar"
                              onClick={() => setDeleteCandidate(c.code)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar código</DialogTitle>
            <DialogDescription>
              ¿Eliminar el código <strong className="font-mono">{deleteCandidate}</strong>?
              Si todavía no fue redimido, ya no podrá usarse para activar una cuenta.
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
