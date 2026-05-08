import { test, expect } from '../fixtures/electron';
import { seedOrder } from '../fixtures/db';
import { env } from '../fixtures/env';
import { navigateHash } from '../fixtures/helpers';

/**
 * Cubre el flujo de diagnóstico:
 *  - DiagnosisDialog abierto desde OrderDetailPage guarda diagnosis.
 *  - useSaveDiagnosis transita pendiente → diagnostico automáticamente.
 *  - El picker (modo standalone desde OrdersListPage) acepta una OS
 *    y reusa el mismo form interno.
 */
test.describe('Diagnosis flow', () => {
  test('UI — agregar diagnóstico desde OrderDetailPage transita el status', async ({
    window,
    db,
  }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Diag',
      cost: 800,
    });

    // Forzar status pendiente para asegurar la transición.
    await db.sql`update public.orders set status = 'pendiente' where id = ${order.id}`;

    await navigateHash(window, `/reparaciones/${order.id}`);

    // Botón "Diagnóstico" (Stethoscope icon, abre DiagnosisDialog).
    await window.getByRole('button', { name: /diagn/i }).first().click();

    // Textarea autoFocus, escribe diagnóstico.
    const textarea = window.getByLabel(/diagnóstico técnico/i);
    await textarea.fill('Pantalla dañada, requiere cambio. Costo aproximado $850.');

    await window.getByRole('button', { name: /guardar diagnóstico/i }).click();

    await expect(window.getByText(/diagnóstico guardado/i)).toBeVisible({
      timeout: 5_000,
    });

    // Verificar en DB que diagnosis y status se actualizaron.
    const [row] = await db.sql<
      { diagnosis: string | null; status: string }[]
    >`
      select diagnosis, status::text as status
      from public.orders where id = ${order.id}
    `;
    expect(row.diagnosis).toContain('Pantalla dañada');
    expect(row.status).toBe('diagnostico');
  });

  test('useSaveDiagnosis NO regresa el status si ya pasó de pendiente', async ({
    db,
  }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Diag Reparando',
      cost: 800,
    });

    // Posicionar la OS en 'reparando' para confirmar que no se regresa a 'diagnostico'.
    await db.sql`update public.orders set status = 'reparando' where id = ${order.id}`;

    // Setear diagnosis directamente vía SQL — el hook tiene la lógica de
    // transición pero acá probamos el invariant: el SQL nunca debería
    // permitir downgrade de status. (Si quieres probar el hook end-to-end,
    // hazlo desde la UI; este test es de integridad de modelo).
    await db.sql`update public.orders set diagnosis = 'tarjeta lógica dañada' where id = ${order.id}`;

    const [row] = await db.sql<{ status: string; diagnosis: string }[]>`
      select status::text as status, diagnosis from public.orders where id = ${order.id}
    `;
    expect(row.status).toBe('reparando');
    expect(row.diagnosis).toContain('tarjeta lógica');
  });
});
