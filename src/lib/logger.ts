import { Sentry, captureUnlessBenign } from './sentry';

/**
 * Wrapper centralizado de logging para el renderer.
 *
 * - En dev: console.* con prefijo `[scope]` para que los logs sean grep-able.
 * - En prod: error y warn se rutean a Sentry vía captureUnlessBenign,
 *   con el `scope` como tag para poder filtrar en el dashboard.
 *
 * No reemplazar por console.* directo — perdemos el ruteo a Sentry y la
 * normalización del prefix. Si necesitás un caso que no encaje, agregar
 * un método nuevo acá en lugar de hacer bypass.
 *
 * Para electron/main process NO usar este logger (depende de
 * @sentry/electron/renderer). Si en algún momento hace falta, crear
 * electron/logger.ts separado.
 */

type LogContext = Record<string, unknown>;

const isDev = import.meta.env.DEV;

function fmt(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}

function captureWithScope(
  level: 'error' | 'warning' | 'info',
  scope: string,
  message: string,
  err: unknown,
  ctx?: LogContext,
): void {
  Sentry.withScope((s) => {
    s.setTag('scope', scope);
    s.setLevel(level);
    if (ctx) s.setExtras(ctx);
    // Nota: NO pasar `ctx` a captureUnlessBenign / captureException — los
    // extras ya están en el scope. Si los pasamos en el segundo arg,
    // sobrescriben el scope context y el `setLevel` se pierde.
    if (level === 'error') {
      captureUnlessBenign(err);
    } else if (err) {
      Sentry.captureException(err);
    } else {
      // Warnings o info sin Error: capturar como mensaje para que sí
      // lleguen a Sentry (de otra forma quedaban silenciados).
      Sentry.captureMessage(message, level);
    }
  });
}

export const log = {
  /**
   * Error severo: algo falló de forma inesperada. En prod va a Sentry
   * (filtrando errores benignos como JWT expired, RLS denied).
   * @param scope feature o módulo (ej: 'auth', 'cash', 'orders').
   */
  error(scope: string, message: string, err?: unknown, ctx?: LogContext): void {
    console.error(fmt(scope, message), err ?? '');
    captureWithScope('error', scope, message, err ?? new Error(message), { ...ctx, message });
  },

  /**
   * Advertencia: algo fuera de lo normal pero recuperable. En prod
   * va a Sentry como warning (no error).
   */
  warn(scope: string, message: string, ctx?: LogContext): void {
    console.warn(fmt(scope, message), ctx ?? '');
    captureWithScope('warning', scope, message, undefined, ctx);
  },

  /**
   * Información de operación normal. NO va a Sentry — solo console
   * para no inflar el ruido en producción.
   */
  info(scope: string, message: string, ctx?: LogContext): void {
    console.info(fmt(scope, message), ctx ?? '');
  },

  /**
   * Debug: solo se imprime en dev. En prod no hace nada.
   * Para tracing temporal de bugs.
   */
  debug(scope: string, message: string, ctx?: LogContext): void {
    if (!isDev) return;
    console.debug(fmt(scope, message), ctx ?? '');
  },
};
