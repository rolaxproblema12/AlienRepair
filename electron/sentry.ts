import * as Sentry from '@sentry/electron/main';

// Inyectado por electron-vite via define en electron.vite.config.ts.
declare const __SENTRY_DSN_MAIN__: string | undefined;
declare const __APP_VERSION__: string;

const dsn =
  (typeof __SENTRY_DSN_MAIN__ !== 'undefined' && __SENTRY_DSN_MAIN__) ||
  process.env.SENTRY_DSN_MAIN ||
  '';

Sentry.init({
  dsn,
  enabled: !!dsn,
  release: `alienrepair@${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`,
  environment: process.env.NODE_ENV ?? 'production',
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
