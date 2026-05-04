import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { env } from '../fixtures/env';

/**
 * Cubre el RPC redeem_access_code (no UI — solo PostgREST + JWT).
 *
 * Limitación: el user E2E asumido por el resto de tests está ACTIVE,
 * así que no podemos ejercitar la rama "código inválido / rate limit"
 * (la función early-returns con `already_active=true` antes de validar
 * el código). Para esos paths se necesita un user inactivo dedicado;
 * dejado como deuda — necesitaría seedear auth.users vía service-role.
 *
 * Lo que sí cubrimos:
 *   1. RPC sin auth → rechazo "No autenticado".
 *   2. RPC con user activo → returns ok=true + already_active=true.
 *      Esto verifica que el RPC existe, está deployed y respeta la
 *      semántica del early return (no debería cambiar profiles).
 */

test.describe('redeem_access_code RPC', () => {
  test('llamado sin sesión es rechazado', async () => {
    const anon = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { data, error } = await anon.rpc('redeem_access_code', { p_code: 'NOPE' });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/no autenticado/i);
  });

  test('llamado por user ya activo es no-op idempotente', async () => {
    const client = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { error: signinErr } = await client.auth.signInWithPassword({
      email: env.userEmail,
      password: env.userPassword,
    });
    expect(signinErr).toBeNull();

    const { data, error } = await client.rpc('redeem_access_code', {
      p_code: 'ANY-CODE',
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, already_active: true });

    await client.auth.signOut().catch(() => {});
  });
});
