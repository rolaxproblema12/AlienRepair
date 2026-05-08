import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useBackupExport } from '../backup/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/errors';

/**
 * Card de "Backup de datos" — botón que descarga un JSON con todas las
 * tablas transaccionales y de catálogo de la sucursal. No hay restore
 * desde la app (ver backup/hooks.ts).
 */
export function BackupCard({ sucursalId }: { sucursalId: string }) {
  const backup = useBackupExport();

  async function handleExport() {
    try {
      const result = await backup.mutateAsync(sucursalId);
      const totalRows = Object.values(result.bundle.counts).reduce(
        (s, n) => s + n,
        0,
      );
      if (result.errors.length) {
        toast.warning(
          `Backup descargado con ${result.errors.length} tablas con errores`,
          { description: result.errors.join('\n') },
        );
      } else {
        toast.success(
          `Backup descargado · ${totalRows.toLocaleString('es-MX')} filas en ${
            Object.keys(result.bundle.counts).length
          } tablas`,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup de datos</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p>
            Descarga un archivo JSON con todos los datos de esta sucursal:
            clientes, órdenes, productos, piezas, ventas, gastos, sesiones de
            caja y settings.
          </p>
          <p className="text-xs text-muted-foreground">
            Sirve como respaldo portable. La restauración no está soportada
            desde la app — usa el backup nativo de Supabase para recovery.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={backup.isPending}
        >
          <Download className="mr-2 h-4 w-4" />
          {backup.isPending ? 'Descargando…' : 'Descargar backup'}
        </Button>
      </CardContent>
    </Card>
  );
}
