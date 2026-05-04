import { defineConfig } from '@playwright/test';

/**
 * Playwright config para tests e2e contra la app empacada de Electron.
 *
 * Pre-requisitos:
 * 1. Proyecto Supabase staging dedicado (NO usar la DB de prod).
 * 2. Variables en .env.local:
 *      E2E_SUPABASE_URL=https://...staging.supabase.co
 *      E2E_SUPABASE_ANON_KEY=...
 *      E2E_SUPABASE_SERVICE_ROLE_KEY=...   (para limpieza/seed)
 *      E2E_SUPABASE_DB_URL=postgresql://... (mismo formato que SUPABASE_DB_URL)
 *      E2E_USER_EMAIL=qa@alientechnology.local
 *      E2E_USER_PASSWORD=<password>
 *      E2E_SUCURSAL_ID=00000000-...
 * 3. La sucursal de test debe existir y el user E2E debe estar asignado a ella.
 * 4. Las migraciones 0001 a 0032 ya aplicadas vía `npm run db:migrate`.
 * 5. Build previo: `npm run build` (los specs lanzan dist-electron/main/index.js).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial: comparten DB staging
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
