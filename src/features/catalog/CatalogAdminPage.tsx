import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCatalog,
  useLastCatalogUpdate,
  useMarkupSetting,
  useRefreshCatalog,
  useUpdateMarkupSetting,
} from './hooks';
import {
  DEFAULT_MARKUP_MULTIPLIER,
  markupPctToMultiplier,
  multiplierToMarkupPct,
} from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/errors';

export default function CatalogAdminPage() {
  const catalogQ = useCatalog();
  const markupQ = useMarkupSetting();
  const lastUpdate = useLastCatalogUpdate();
  const refreshM = useRefreshCatalog();
  const updateMarkup = useUpdateMarkupSetting();

  const [markupInput, setMarkupInput] = useState<string>('');
  const [progress, setProgress] = useState<{ page: number; found: number } | null>(null);

  // Inicializar el input con el valor del server una sola vez (cuando llega).
  // Cualquier edit posterior del user lo deja > '', así que el guard previene
  // sobreescribir lo tipeado.
  useEffect(() => {
    if (markupQ.data != null && markupInput === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarkupInput(String(multiplierToMarkupPct(markupQ.data)));
    }
  }, [markupQ.data, markupInput]);

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

  async function handleSaveMarkup() {
    const pct = Number(markupInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
      toast.error('Margen inválido (0 a 1000)');
      return;
    }
    const multiplier = markupPctToMultiplier(pct);
    try {
      await updateMarkup.mutateAsync(multiplier);
      toast.success(`Margen guardado: ${pct}% (×${multiplier})`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const currentMultiplier = markupQ.data ?? DEFAULT_MARKUP_MULTIPLIER;
  const previewPurchase = 100;
  const previewSale =
    Math.round(previewPurchase * markupPctToMultiplier(Number(markupInput || 0)) * 100) / 100;

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
            <Stat label="Margen" value={`${multiplierToMarkupPct(currentMultiplier)}%`} />
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

      <Card>
        <CardHeader>
          <CardTitle>Margen sugerido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Multiplicador aplicado al precio de compra para sugerir el precio de venta. Por
            ejemplo, 150% significa que una pieza de $100 se sugiere a $250.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="markup">Margen %</Label>
              <Input
                id="markup"
                type="number"
                min={0}
                max={1000}
                step={5}
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vista previa</Label>
              <div className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-mono">
                $100 → ${previewSale.toFixed(2)}
              </div>
            </div>
          </div>
          <Button onClick={handleSaveMarkup} disabled={updateMarkup.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMarkup.isPending ? 'Guardando…' : 'Guardar margen'}
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
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${warning ? 'text-amber-400' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
