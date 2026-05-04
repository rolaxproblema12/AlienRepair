import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { AlienLogo } from '@/components/brand/AlienLogo';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowEscape(false);
      return;
    }
    const escape = setTimeout(() => setShowEscape(true), 6_000);
    return () => clearTimeout(escape);
  }, [loading]);

  function hardReset() {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    window.location.hash = '#/login';
    window.location.reload();
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-background">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative animate-pulse">
          <AlienLogo size={56} glow />
        </div>
        <Loader2 className="relative h-5 w-5 animate-spin text-primary" />
        <p className="relative text-sm text-muted-foreground">Verificando sesión…</p>
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
  if (session && profile?.active) return <Navigate to="/dashboard" replace />;
  if (session && !profile?.active) return <Navigate to="/signup-code" replace />;
  return <>{children}</>;
}
