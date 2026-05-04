import { test, expect } from '../fixtures/electron';
import { seedOrder } from '../fixtures/db';
import { env } from '../fixtures/env';

test.describe('Abono a orden de servicio', () => {
  test('registra pago, vincula con sesión abierta, balance decrece', async ({ window, db }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Juan Test',
      cost: 1000,
    });

    // Abrir caja
    await window.goto('http://localhost/#/caja').catch(() => {});
    await window.getByRole('button', { name: /abrir caja/i }).click();
    await window.getByLabel(/monto inicial/i).fill('0');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // Ir a la orden y abonar
    await window.goto(`http://localhost/#/reparaciones/${order.id}`).catch(() => {});
    await window.getByRole('button', { name: /registrar abono/i }).click();
    await window.getByLabel(/monto/i).fill('400');
    await window.getByRole('button', { name: /confirmar/i }).click();

    const [pay] = await db.sql<{ amount: number; cash_session_id: string | null }[]>`
      select amount::float as amount, cash_session_id from public.order_payments
      where order_id = ${order.id} order by created_at desc limit 1
    `;
    expect(pay.amount).toBeCloseTo(400);
    expect(pay.cash_session_id).not.toBeNull();

    const [bal] = await db.sql<{ balance: number; paid: number }[]>`
      select balance::float as balance, paid::float as paid
      from public.v_order_balance where order_id = ${order.id}
    `;
    expect(bal.paid).toBeCloseTo(400);
    expect(bal.balance).toBeCloseTo(600);
  });
});
