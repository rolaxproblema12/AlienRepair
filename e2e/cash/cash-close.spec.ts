import { test, expect } from '../fixtures/electron';
import { seedProduct } from '../fixtures/db';
import { env } from '../fixtures/env';

test.describe('Cierre de caja', () => {
  test('cierra con conteo, calcula diferencia, marca sesión closed', async ({ window, db }) => {
    await seedProduct(db.sql, env.sucursalId, { name: 'Mica', price: 100, stock: 10 });

    // Abrir caja con $200 inicial
    await window.goto('http://localhost/#/caja').catch(() => {});
    await window.getByRole('button', { name: /abrir caja/i }).click();
    await window.getByLabel(/monto inicial/i).fill('200');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // Vender una mica en efectivo (esperado: $200 + $100 = $300 esperado)
    await window.getByRole('link', { name: /nueva venta/i }).click();
    await window.getByPlaceholder(/buscar producto/i).fill('Mica');
    await window.getByText('Mica').first().click();
    await window.getByRole('button', { name: /cobrar/i }).click();
    await window.getByRole('link', { name: /caja/i }).first().click();

    // Cerrar con $310 (sobrante de $10)
    await window.getByRole('button', { name: /cerrar caja/i }).click();
    await window.getByLabel(/efectivo contado/i).fill('310');
    await window.getByRole('button', { name: /confirmar/i }).click();

    const [sess] = await db.sql<{ status: string; difference: number }[]>`
      select status, difference::float as difference from public.cash_sessions
      where sucursal_id = ${env.sucursalId} order by created_at desc limit 1
    `;
    expect(sess.status).toBe('closed');
    expect(sess.difference).toBeCloseTo(10);
  });
});
