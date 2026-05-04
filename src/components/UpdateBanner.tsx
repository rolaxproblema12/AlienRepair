import { useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, RefreshCw, X } from 'lucide-react';
import type { UpdaterStatus } from '../../shared/updater-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const off = window.alien?.updater?.onStatus((s) => {
      setStatus(s);
      // Cualquier transición no-pasiva resetea dismiss para que el usuario
      // vuelva a verla.
      if (s.kind === 'downloading' || s.kind === 'downloaded' || s.kind === 'error') {
        setDismissed(false);
      }
    });
    return off;
  }, []);

  if (dismissed) return null;
  if (status.kind === 'idle' || status.kind === 'checking' || status.kind === 'not-available') {
    return null;
  }

  if (status.kind === 'error') {
    return (
      <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-foreground">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span>
              No se pudo verificar actualizaciones: <strong>{status.message}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void window.alien.updater.checkNow()}
              className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-md p-1 text-destructive/80 hover:text-destructive"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDownloaded = status.kind === 'downloaded';
  const releaseNotes =
    status.kind === 'available' || status.kind === 'downloaded'
      ? status.releaseNotes
      : undefined;

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
          {releaseNotes && <ReleaseNotesDialog notes={releaseNotes} />}
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

function ReleaseNotesDialog({ notes }: { notes: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
        >
          <FileText className="h-3 w-3" />
          Ver cambios
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Notas de versión</DialogTitle>
        </DialogHeader>
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-xs text-foreground">
          {notes}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
