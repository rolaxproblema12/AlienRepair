import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCatalog,
  useLastCatalogUpdate,
  useMarkupSetting,
  useRefreshCatalog,
} from './hooks';
import { multiplierToMarkupPct } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/errors';

export default function CatalogAdminPage() {
  const catalogQ = useCatalog();
  const markupQ = useMarkupSetting();
  const lastUpdate = useLastCatalogUpdate();
  const refreshM = useRefreshCatalog();

  const [progress, setProgress] = useState<{ page: number; found: number } | null>(null);

  useEffect(() => {
    const off = window.alien.catalog.onRefreshProgress((p) => setProgress(p));
    return () => {
      off();
    };
  }, []);

  async function handleRefresh() {
    setProgress(null);
    try {
      const res = await refreshM.mutateAsync();
      toast.success(
        `Catálogo actualizado: ${res.count.toLocaleString('es-MX')} productos en ${(res.durationMs / 1000).toFixed(1)} s`,
      );
      setProgress(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <Link
        to="/catalogo"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">Configurar catálogo</h1>

      <Card>
        <CardHeader>
          <CardTitle>Estado actual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Productos"
              value={(catalogQ.data?.length ?? 0).toLocaleString('es-MX')}
            />
            <Stat
              label="Margen"
              value={markupQ.data == null ? '—' : `${multiplierToMarkupPct(markupQ.data)}%`}
            />
            <Stat
              label="Última actualización"
              value={
                lastUpdate.daysAgo == null
                  ? '—'
                  : lastUpdate.daysAgo === 0
                    ? 'hoy'
                    : `hace ${lastUpdate.daysAgo} d`
              }
              warning={lastUpdate.isStale}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Margen ajustable en{' '}
            <Link to="/admin/configuracion" className="text-primary hover:underline">
              Configuración → Catálogo
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actualizar catálogo desde fixoem.com</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Descarga el catálogo público de fixoem.com (32 páginas, ~30s). Sustituye los precios
            locales en este equipo. Otros equipos del local mantienen su propia copia.
          </p>
          {refreshM.isPending && (
            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {progress
                  ? `Descargando página ${progress.page}… (${progress.found} productos hasta ahora)`
                  : 'Iniciando…'}
              </div>
            </div>
          )}
          <Button onClick={handleRefresh} disabled={refreshM.isPending}>
            <Download className="mr-2 h-4 w-4" />
            {refreshM.isPending ? 'Descargando…' : 'Actualizar catálogo'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${warning ? 'text-amber-500' : ''}`}>{value}</p>
    </div>
  );
}
