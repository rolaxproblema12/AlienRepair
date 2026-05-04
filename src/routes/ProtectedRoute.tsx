import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlienLogo } from '@/components/brand/AlienLogo';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { session, profile, loading, signOut } = useAuth();
  const [showEscape, setShowEscape] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const start = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);
    const escape = setTimeout(() => setShowEscape(true), 10_000);
    return () => {
      clearInterval(tick);
      clearTimeout(escape);
    };
  }, [loading]);

  async function hardReset() {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    try { await signOut(); } catch (_) {}
    window.location.hash = '#/login';
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-background">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-center gap-3">
          <div className="animate-pulse">
            <AlienLogo size={56} glow />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Cargando tu cuenta…
            {elapsed >= 3 && (
              <span className="ml-1 text-xs opacity-60">({elapsed}s)</span>
            )}
          </p>
          {elapsed >= 5 && (
            <p className="max-w-xs text-center text-xs text-muted-foreground/70">
              Conectando con Supabase. Si es tu primer acceso del día puede tardar unos segundos.
            </p>
          )}
        </div>
        {showEscape && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="relative text-xs text-muted-foreground">
                ¿Sigue cargando? Limpiar sesión local
              </Button>
            }
            title="¿Limpiar sesión local?"
            description="Se borrarán las credenciales guardadas en este equipo. Tendrás que iniciar sesión de nuevo."
            confirmLabel="Sí, limpiar"
            destructive
            onConfirm={hardReset}
          />
        )}
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.active) return <Navigate to="/signup-code" replace />;

  return <Outlet />;
}
