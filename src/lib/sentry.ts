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
    // Limpiar request body — puede contener PII (customer_id, order_id,
    // amount, notes con texto del cliente, etc) que un POST 500 capturó.
    // Sin esto, esos datos llegan a Sentry sin filtro.
    if (event.request?.data) {
      event.request.data = '[redacted]';
    }
    // Limpiar contexts.extra si trae campos que parecen PII proxies. El
    // logger pasa orderId/customerId/amount como debug, pero a Sentry los
    // hasheamos para reducir superficie sin perder agrupación de errores.
    const extra = event.extra;
    if (extra && typeof extra === 'object') {
      for (const k of ['customerId', 'customer_id', 'phone', 'email']) {
        if (k in extra) delete (extra as Record<string, unknown>)[k];
      }
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
