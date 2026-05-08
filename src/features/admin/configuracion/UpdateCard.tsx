import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Download, RefreshCw } from 'lucide-react';
import pkg from '../../../../package.json';
import type { UpdaterStatus } from '../../../../shared/updater-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Card en Configuración → Datos del shop con info de versión actual y
 * acciones de actualización (buscar, instalar). Reemplaza al botón
 * antiguo en la barra superior del AppShell — el `<UpdateBanner />`
 * sigue arriba de la app para feedback ambient cuando hay update.
 */
export function UpdateCard() {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.alien?.updater) return;
    const off = window.alien.updater.onStatus((s: UpdaterStatus) => {
      setStatus(s);
      // Limpiar busy cuando llega cualquier estado terminal del check.
      if (
        s.kind === 'not-available' ||
        s.kind === 'available' ||
        s.kind === 'error' ||
        s.kind === 'downloaded'
      ) {
        setBusy(false);
      }
    });
    return off;
  }, []);

  if (!window.alien?.updater) {
    // No estamos en Electron empacado (ej: dev sin UPDATE_TEST_DEV).
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actualizaciones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Versión actual: <strong className="text-foreground">v{pkg.version}</strong>.
          Las actualizaciones automáticas funcionan solo en la app empaquetada.
        </CardContent>
      </Card>
    );
  }

  async function handleCheck() {
    if (busy) return;
    setBusy(true);
    try {
      await window.alien.updater.checkNow();
    } catch (err) {
      setBusy(false);
      toast.error(`Error: ${(err as Error).message}`);
    }
  }

  async function handleInstall() {
    try {
      await window.alien.updater.quitAndInstall();
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actualizaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Versión actual</span>
          <strong className="font-mono">v{pkg.version}</strong>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Estado</span>
          <span className="text-right">{statusLabel(status)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={busy || status.kind === 'downloading'}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Buscando…' : 'Buscar actualizaciones'}
          </Button>
          {status.kind === 'downloaded' && (
            <Button type="button" size="sm" onClick={handleInstall}>
              <Download className="mr-2 h-3.5 w-3.5" />
              Reiniciar e instalar v{status.version}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(s: UpdaterStatus): string {
  switch (s.kind) {
    case 'idle':
      return 'Listo';
    case 'checking':
      return 'Buscando…';
    case 'not-available':
      return 'Estás en la versión más reciente';
    case 'available':
      return `v${s.version} disponible — descargando…`;
    case 'downloading':
      return `Descargando ${Math.round(s.percent ?? 0)}%`;
    case 'downloaded':
      return `v${s.version} lista para instalar`;
    case 'error':
      return `Error: ${s.message}`;
  }
}
