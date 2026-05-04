import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

export default function UpdateBanner() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const off = window.alien?.updater?.onStatus((s) => {
      setStatus(s);
      if (s.kind === 'downloading' || s.kind === 'downloaded') setDismissed(false);
    });
    return off;
  }, []);

  if (dismissed) return null;
  if (status.kind === 'idle' || status.kind === 'checking' || status.kind === 'not-available') {
    return null;
  }

  if (status.kind === 'error') return null;

  const isDownloaded = status.kind === 'downloaded';

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isDownloaded ? (
            <RefreshCw className="h-4 w-4 shrink-0" />
          ) : (
            <Download className="h-4 w-4 shrink-0 animate-pulse" />
          )}
          <span>
            {status.kind === 'available' && (
              <>Nueva versión <strong>{status.version}</strong> disponible. Descargando…</>
            )}
            {status.kind === 'downloading' && (
              <>Descargando actualización… <strong>{status.percent}%</strong></>
            )}
            {isDownloaded && (
              <>Versión <strong>{status.version}</strong> lista. Reinicia para aplicarla.</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDownloaded && (
            <button
              type="button"
              onClick={() => void window.alien.updater.quitAndInstall()}
              className="rounded-md bg-amber-500 px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-400"
            >
              Reiniciar y actualizar
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-amber-100/70 hover:text-amber-100"
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
