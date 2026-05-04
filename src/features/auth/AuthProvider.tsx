import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSucursalStore } from '@/lib/sucursalStore';
import { getErrorMessage } from '@/lib/errors';

export type UserRole = 'admin' | 'usuario';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_CACHE_KEY = 'alien:profile';

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    return parsed?.id === userId ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // localStorage puede no estar disponible
  }
}

// Limpia tokens stale de Supabase del localStorage. Útil cuando detectamos
// que la sesión guardada ya fue invalidada server-side (refresh falla con
// 401/403). Sin esto, cada arranque hace POST /logout y vemos 403 en consola.
function clearStaleSupabaseStorage() {
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.includes('supabase'))) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresca el perfil contra Supabase. Si `silent`, no muestra toast ni
  // limpia el cache en error (útil para revalidación en background).
  // Si la query falla por JWT vencido (PGRST301 / "JWT expired"), intentamos
  // un refresh manual y reintentamos una sola vez. Si el refresh también falla,
  // limpiamos la sesión: dejar la sesión "fantasma" (token muerto pero presente)
  // atrapa al usuario en /signup-code aunque su perfil sea admin/active en DB.
  async function fetchProfile(userId: string, { silent = false } = {}) {
    // Hacemos la query con fetch crudo (no via supabase.from) porque el cliente
    // de supabase-js a veces se atora en su lock interno (acquireLock) durante
    // un auto-refresh hung, dejando todas las queries colgadas para siempre.
    // Con fetch directo evitamos ese deadlock: si pasa, vemos el error real.
    async function runQuery(): Promise<{ data: Profile | null; error: { message: string; code?: string } | null }> {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      // Leemos el access_token directo de localStorage para no depender del
      // cliente supabase-js (que puede estar bloqueado en su lock interno).
      let token: string | undefined;
      try {
        const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
        const raw = ref ? window.localStorage.getItem(`sb-${ref}-auth-token`) : null;
        if (raw) token = JSON.parse(raw)?.access_token;
      } catch {
        /* ignore */
      }
      if (!token) return { data: null, error: { message: 'Sin sesión' } };

      const endpoint = `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,role,active`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      try {
        const r = await fetch(endpoint, {
          method: 'GET',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Accept-Profile': 'public',
          },
          signal: ctrl.signal,
        });
        const body = await r.json().catch(() => null);
        if (!r.ok) {
          return {
            data: null,
            error: { message: body?.message ?? `HTTP ${r.status}`, code: body?.code },
          };
        }
        const row = Array.isArray(body) ? body[0] : body;
        if (!row) return { data: null, error: { message: 'Profile no encontrado', code: 'PGRST116' } };
        return { data: row as Profile, error: null };
      } catch (err) {
        return {
          data: null,
          error: { message: err instanceof Error ? err.message : String(err) },
        };
      } finally {
        clearTimeout(t);
      }
    }

    function isJwtError(err: { message?: string; code?: string } | null) {
      if (!err) return false;
      const msg = (err.message ?? '').toLowerCase();
      return (
        err.code === 'PGRST301' ||
        msg.includes('jwt') ||
        msg.includes('token') ||
        msg.includes('expired')
      );
    }

    try {
      let { data, error } = await runQuery();
      if (error && isJwtError(error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.error || !refreshed.data.session) {
          clearStaleSupabaseStorage();
          writeCachedProfile(null);
          setSession(null);
          setProfile(null);
          if (!silent) toast.error('Sesión expirada. Inicia sesión de nuevo.');
          return null;
        }
        ({ data, error } = await runQuery());
      }
      if (error) {
        if (!silent) {
          console.error('[Auth] No se pudo cargar el perfil', error);
          toast.error(`No se pudo cargar perfil: ${error.message}`);
        }
        return null;
      }
      setProfile(data as Profile);
      writeCachedProfile(data as Profile);
      return data as Profile;
    } catch (err) {
      if (!silent) {
        console.error('[Auth] loadProfile excepción', err);
        toast.error(getErrorMessage(err));
      }
      return null;
    }
  }

  // Safety net global: cada vez que `loading` pase a true, garantizamos que
  // baje en máximo 12s. Cubre cualquier path que active el spinner (load
  // inicial, deep-link de OAuth, SIGNED_IN), incluso si fetchProfile o
  // exchangeCodeForSession se quedan colgados por cold start de Supabase.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 12_000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        // Si Supabase reporta error o no hay user pero hay tokens guardados,
        // probablemente la sesión fue revocada server-side. Limpiamos sin ruido.
        if (error || !data.session) {
          if (error) clearStaleSupabaseStorage();
          setLoading(false);
          return;
        }

        // Si el access_token guardado ya está vencido, el auto-refresh de
        // supabase-js puede no haberse disparado todavía (o haber fallado en
        // background). Forzamos un refresh manual antes de proceder. Sin esto,
        // fetchProfile fallaría con "JWT expired" en silencio y dejaría al
        // usuario atrapado en /signup-code aunque su perfil sea admin/active.
        let session = data.session;
        const expiresAt = Number(session.expires_at ?? 0);
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt < nowSec + 30) {
          const refreshed = await supabase.auth.refreshSession();
          if (!mounted) return;
          if (refreshed.error || !refreshed.data.session) {
            clearStaleSupabaseStorage();
            writeCachedProfile(null);
            setSession(null);
            setLoading(false);
            return;
          }
          session = refreshed.data.session;
        }

        setSession(session);
        const userId = session.user.id;
        const cached = readCachedProfile(userId);
        if (cached) {
          setProfile(cached);
          setLoading(false);
          fetchProfile(userId, { silent: true });
        } else {
          await fetchProfile(userId);
          if (mounted) setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession error', err);
        clearStaleSupabaseStorage();
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setProfile(null);
        writeCachedProfile(null);
        return;
      }

      // SIGNED_IN: usuario recién logueado, cargamos perfil mostrando loading.
      // INITIAL_SESSION: la maneja getSession() arriba — no duplicamos.
      // TOKEN_REFRESHED: no recargamos perfil (evita parpadeo).
      if (event === 'SIGNED_IN') {
        const userId = newSession.user.id;
        const cached = readCachedProfile(userId);
        if (cached) {
          setProfile(cached);
          fetchProfile(userId, { silent: true });
        } else {
          setLoading(true);
          try {
            await fetchProfile(userId);
          } finally {
            if (mounted) setLoading(false);
          }
        }
      }
    });

    // Deep-link del proceso main (OAuth callback)
    const removeListener = window.alien?.onAuthDeepLink?.((url) => {
      const parsed = new URL(url);
      const searchParams = new URLSearchParams(parsed.search);
      const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');

      // PKCE flow: Supabase manda ?code=... → intercambiar por sesión
      const code = searchParams.get('code') ?? hashParams.get('code');
      if (code) {
        setLoading(true);
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ error }) => {
            if (error) {
              console.error('[Auth] exchangeCodeForSession error', error);
              toast.error(`Error al iniciar sesión: ${error.message}`);
              if (mounted) setLoading(false);
            }
            // onAuthStateChange SIGNED_IN se encargará de cargar perfil y bajar loading.
          })
          .catch((err) => {
            console.error('[Auth] exchangeCodeForSession excepción', err);
            toast.error(`Error al iniciar sesión: ${getErrorMessage(err)}`);
            if (mounted) setLoading(false);
          });
        return;
      }

      console.warn('[Auth] deep-link sin code PKCE — ignorado', parsed.pathname);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      removeListener?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'alienrepair://auth/callback',
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          await window.alien.openExternal(data.url);
        }
      },
      async signOut() {
        try { await supabase.auth.signOut(); } catch (_) {}
        writeCachedProfile(null);
        // Limpiar sucursal activa: el próximo usuario que entre debe re-elegir
        // (o auto-seleccionar la primera de las suyas).
        useSucursalStore.getState().setCurrentSucursalId(null);
        setSession(null);
        setProfile(null);
      },
      async refreshProfile() {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) await fetchProfile(data.session.user.id);
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
