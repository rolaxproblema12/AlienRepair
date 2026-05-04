import { test, expect } from '../fixtures/electron';
import { navigateHash } from '../fixtures/helpers';

/**
 * Double-gate del acceso: ProtectedRoute requiere session AND
 * profile.active=true. Para users ya activos, /signup-code debe
 * redirigir a /dashboard — sin esto, podrían quedar atrapados
 * intentando canjear códigos cuando ya no lo necesitan.
 */

test.describe('Auth double-gate', () => {
  test('user activo en /signup-code redirige a /dashboard', async ({ window }) => {
    await navigateHash(window, '/signup-code');

    // El sidebar de AppShell expone "Dashboard" como NavLink.
    await expect(window.getByRole('link', { name: /^dashboard$/i })).toBeVisible({
      timeout: 5_000,
    });

    // El hash debe haber cambiado a /dashboard. Si quedó en /signup-code
    // es regresión del redirect en SignupWithCodePage.
    const hash = await window.evaluate(() => window.location.hash);
    expect(hash).toMatch(/#\/dashboard/);
  });
});
