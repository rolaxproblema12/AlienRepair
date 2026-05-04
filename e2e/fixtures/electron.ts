/**
 * Fixture de Playwright que arranca la app Electron empacada y da acceso
 * a la primera ventana, además de inyectar la sesión Supabase y la sucursal
 * activa para saltarse el flujo de login interactivo.
 */
import { _electron as electron, test as base } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';
import { env } from './env';
import { openDb, resetTransactional, type DbHandle } from './db';

interface Fixtures {
  electronApp: ElectronApplication;
  window: Page;
  db: DbHandle;
}

export const test = base.extend<Fixtures>({
  db: async ({}, use) => {
    const db = openDb();
    try {
      await resetTransactional(db.sql, env.sucursalId);
      await use(db);
    } finally {
      await db.end();
    }
  },

  electronApp: async ({}, use) => {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: env.userEmail,
      password: env.userPassword,
    });
    if (error || !data.session) {
      throw new Error(`Login E2E falló: ${error?.message ?? 'sin sesión'}`);
    }

    const ref = new URL(env.supabaseUrl).hostname.split('.')[0];
    const sessionPayload = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
      user: data.session.user,
    };

    const electronApp = await electron.launch({
      args: [resolve(process.cwd(), 'dist-electron/main/index.js')],
      env: {
        ...process.env,
        VITE_SUPABASE_URL: env.supabaseUrl,
        VITE_SUPABASE_ANON_KEY: env.supabaseAnonKey,
        // Inyectar storage values via init script abajo.
        E2E_SB_REF: ref,
        E2E_SESSION_JSON: JSON.stringify(sessionPayload),
        E2E_SUCURSAL_ID: env.sucursalId,
      },
    });

    const page = await electronApp.firstWindow();
    await page.evaluate(
      ({ ref, session, sucursalId }) => {
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
        localStorage.setItem(
          'alien:current-sucursal',
          JSON.stringify({ state: { currentSucursalId: sucursalId }, version: 0 }),
        );
      },
      { ref, session: sessionPayload, sucursalId: env.sucursalId },
    );
    await page.reload();
    await use(electronApp);
    await electronApp.close();
  },

  window: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

export { expect } from '@playwright/test';
