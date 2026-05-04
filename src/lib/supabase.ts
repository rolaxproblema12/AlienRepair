import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon || url.includes('YOUR_PROJECT')) {
  console.warn(
    '[AlienRepair] Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local'
  );
}

// Pre-limpieza: si el access_token guardado expiró hace más de 7 días, el
// refresh_token casi seguro fue rotado/revocado server-side. Borrar antes de
// que createClient dispare el auto-refresh evita el ruidoso 400 "Invalid
// Refresh Token: Refresh Token Not Found" en consola al arrancar.
function preCleanStaleAuthStorage() {
  try {
    const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
    if (!ref) return;
    const key = `sb-${ref}-auth-token`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const expiresAt = Number(parsed?.expires_at ?? 0);
    if (!expiresAt) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    if (expiresAt < nowSec - SEVEN_DAYS) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`${key}-code-verifier`);
    }
  } catch {
    // ignore: storage corrupto, JSON inválido, etc.
  }
}
preCleanStaleAuthStorage();

const FETCH_TIMEOUT_MS = 15_000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const signal = init?.signal;
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
};

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: window.localStorage,
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
