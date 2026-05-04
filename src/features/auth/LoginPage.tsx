import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlienLogo } from '@/components/brand/AlienLogo';
import { toast } from 'sonner';
import { Loader2, Smartphone, Receipt, ShieldCheck } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.43-1.7 4.2-5.5 4.2-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.15.8 3.87 1.5l2.64-2.54C16.86 3.5 14.66 2.5 12 2.5 6.75 2.5 2.5 6.75 2.5 12S6.75 21.5 12 21.5c6.93 0 9.5-4.86 9.5-7.37 0-.5-.05-.88-.12-1.26H12Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.66 0 4.87-.88 6.5-2.38l-3.1-2.4c-.85.58-2 1-3.4 1-2.6 0-4.8-1.75-5.6-4.1H3.2v2.5A9.5 9.5 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.62a5.8 5.8 0 0 1 0-3.24V7.88H3.2a9.5 9.5 0 0 0 0 8.24l3.2-2.5Z"
      />
      <path
        fill="#4285F4"
        d="M12 6.5c1.45 0 2.73.5 3.75 1.47l2.8-2.8C16.86 3.5 14.66 2.5 12 2.5A9.5 9.5 0 0 0 3.2 7.88l3.2 2.5C7.2 8.25 9.4 6.5 12 6.5Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithGoogle, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.info('Completa el inicio de sesión en tu navegador.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function hardReset() {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    window.location.hash = '#/login';
    window.location.reload();
  }

  const busy = loading || authLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
        {/* Brand panel — oculto en móviles */}
        <aside className="relative hidden overflow-hidden border-r border-border/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />

          <div className="relative flex items-center gap-3">
            <AlienLogo size={40} glow />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-wide">AlienRepair</span>
              <span className="text-xs text-muted-foreground">AlienTechnology</span>
            </div>
          </div>

          <div className="relative space-y-8">
            <div>
              <h1 className="text-5xl font-bold tracking-tight">
                Tu taller,
                <br />
                <span className="text-primary">bajo control.</span>
              </h1>
              <p className="mt-4 max-w-md text-muted-foreground">
                Gestión integral de reparaciones, encargos, accesorios y contabilidad — hecho
                para refacciones modernas.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              <Feature icon={<Smartphone className="h-4 w-4" />} label="Reparaciones con seguimiento y fotos" />
              <Feature icon={<Receipt className="h-4 w-4" />} label="Encargos, accesorios y ventas en un mismo flujo" />
              <Feature icon={<ShieldCheck className="h-4 w-4" />} label="Contabilidad y acceso multi-usuario con permisos" />
            </ul>
          </div>

          <p className="relative text-xs text-muted-foreground">
            © {new Date().getFullYear()} AlienTechnology. Todos los derechos reservados.
          </p>
        </aside>

        {/* Auth card */}
        <main className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="flex flex-col items-center text-center lg:hidden">
              <AlienLogo size={56} glow />
              <h1 className="mt-3 text-2xl font-semibold">AlienRepair</h1>
              <p className="text-sm text-muted-foreground">AlienTechnology</p>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">Inicia sesión</h2>
              <p className="text-sm text-muted-foreground">
                Accede con tu cuenta de Google autorizada por el administrador.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 w-full border-border/80 bg-background/60 text-base font-medium hover:bg-accent"
                onClick={handleLogin}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {authLoading && !loading ? 'Verificando sesión...' : 'Abriendo navegador...'}
                  </>
                ) : (
                  <>
                    <GoogleIcon className="h-5 w-5" />
                    Continuar con Google
                  </>
                )}
              </Button>

              <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                Al presionar continuar abriremos tu navegador para autorizar. Cuando termines,
                regresa a esta ventana — detectaremos la sesión automáticamente.
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>¿Problemas para entrar?</span>
              <ConfirmDialog
                trigger={
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Reiniciar sesión local
                  </button>
                }
                title="¿Reiniciar sesión local?"
                description="Se borrarán las credenciales guardadas en este equipo y volverás al login. Útil si quedaste en un estado raro."
                confirmLabel="Sí, reiniciar"
                destructive
                onConfirm={hardReset}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </li>
  );
}
