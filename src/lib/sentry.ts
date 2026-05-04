import * as Sentry from '@sentry/electron/renderer';

const dsn = import.meta.env.VITE_SENTRY_DSN ?? '';
const version = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

Sentry.init({
  dsn,
  enabled: !!dsn,
  release: `alienrepair@${version}`,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['authorization'];
      delete event.request.headers['apikey'];
    }
    return event;
  },
});

export { Sentry };

/**
 * Errores que conocemos y NO queremos enviar a Sentry:
 * - PGRST301: RLS denied (esperado al perder permiso de sucursal)
 * - "JWT expired": esperado tras inactividad
 * - errores de cancelación voluntaria
 */
const KNOWN_BENIGN_PATTERNS = [/PGRST301/, /JWT expired/, /Failed to fetch/i];

export function isBenignError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const code = (err as { code?: string } | null)?.code;
  if (code === 'PGRST301') return true;
  return KNOWN_BENIGN_PATTERNS.some((p) => p.test(msg));
}

export function captureUnlessBenign(err: unknown, context?: Record<string, unknown>) {
  if (isBenignError(err)) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
