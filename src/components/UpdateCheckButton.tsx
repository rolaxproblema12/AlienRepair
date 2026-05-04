import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { UpdaterStatus } from '../../shared/updater-types';

export default function UpdateCheckButton() {
  const [busy, setBusy] = useState(false);
  const manualToastId = useRef<string | number | null>(null);

  useEffect(() => {
    const off = window.alien?.updater?.onStatus((s: UpdaterStatus) => {
      if (manualToastId.current === null) return;
      if (s.kind === 'not-available') {
        toast.success('Estás en la versión más reciente.', { id: manualToastId.current });
        manualToastId.current = null;
        setBusy(false);
      } else if (s.kind === 'available') {
        toast.success(`Actualización disponible: v${s.version}. Descargando…`, {
          id: manualToastId.current,
        });
        manualToastId.current = null;
        setBusy(false);
      } else if (s.kind === 'error') {
        toast.error(`Error al buscar actualizaciones: ${s.message}`, {
          id: manualToastId.current,
        });
        manualToastId.current = null;
        setBusy(false);
      }
    });
    return off;
  }, []);

  if (!window.alien?.updater) return null;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    manualToastId.current = toast.loading('Buscando actualizaciones…');
    try {
      await window.alien.updater.checkNow();
    } catch (err) {
      const id = manualToastId.current;
      manualToastId.current = null;
      setBusy(false);
      toast.error(`Error: ${(err as Error).message}`, id ? { id } : undefined);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Buscar actualizaciones"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
      aria-label="Buscar actualizaciones"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </button>
  );
}
