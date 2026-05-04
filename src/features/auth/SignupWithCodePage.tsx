import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AlienLogo } from '@/components/brand/AlienLogo';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';
import {
  ChevronDown,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';

const CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function formatCode(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export default function SignupWithCodePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, []);

  useEffect(() => {
    if (profile?.active) navigate('/dashboard', { replace: true });
  }, [profile?.active, navigate]);

  const codeValid = useMemo(() => CODE_PATTERN.test(code), [code]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!codeValid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('redeem_access_code', { p_code: code });
      if (error) {
        toast.error(error.message);
        return;
      }
      if ((data as { ok?: boolean })?.ok) {
        toast.success('¡Cuenta activada!');
        await refreshProfile();
      }
    } catch (err) {
      toast.error(`Error: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function forceRefresh() {
    try {
      await refreshProfile();
      toast.info(`Perfil recargado · active=${profile?.active ? 'sí' : 'no'}`);
    } catch (err) {
      toast.error(`Error al recargar perfil: ${getErrorMessage(err)}`);
    }
  }

  function hardReset() {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    signOut().finally(() => {
      window.location.hash = '#/login';
      window.location.reload();
    });
  }

  const greeting = profile?.full_name ?? profile?.email ?? 'Bienvenido';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[32rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <AlienLogo size={52} glow />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Un paso más</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hola <span className="text-foreground">{greeting}</span>. Ingresa el código de acceso
            que te dio el administrador para activar tu cuenta.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur">
          <form onSubmit={handleRedeem} className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="code" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Código de acceso
                </Label>
                {codeValid && (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Formato válido
                  </span>
                )}
              </div>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(formatCode(e.target.value))}
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoFocus
                maxLength={9}
                inputMode="text"
                spellCheck={false}
                className="h-14 text-center font-mono text-xl tracking-[0.4em] uppercase placeholder:tracking-[0.4em] placeholder:text-muted-foreground/40"
              />
              <p className="text-xs text-muted-foreground">
                8 caracteres, letras y números. Ej: <span className="font-mono">A1B2-C3D4</span>
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 w-full text-base font-medium"
              disabled={loading || !codeValid}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validando código...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Activar mi cuenta
                </>
              )}
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Opciones avanzadas
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-[14rem]">
              <DropdownMenuItem onClick={forceRefresh} className="cursor-pointer">
                <RefreshCw className="h-4 w-4" />
                Recargar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    Reiniciar sesión local
                  </DropdownMenuItem>
                }
                title="¿Reiniciar sesión local?"
                description="Se borrarán las credenciales guardadas en este equipo y volverás al login. Úsalo solo si algo quedó trabado."
                confirmLabel="Sí, reiniciar"
                destructive
                onConfirm={hardReset}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
