import { test, expect } from '../fixtures/electron';
import { seedOrder } from '../fixtures/db';
import { env } from '../fixtures/env';
import { navigateHash } from '../fixtures/helpers';

/**
 * Cubre el lifecycle de orders:
 * - Folios se generan per-sucursal y se autoincrementan (next_folio).
 * - down_payment al crear cuenta como `paid` en v_order_balance.
 * - Cambios de status disparan order_status_history.
 * - Flow UI de creación vía formulario (happy path mínimo).
 */

test.describe('Orders lifecycle', () => {
  test('folio se genera per-sucursal y autoincrementa', async ({ db }) => {
    // Después de resetTransactional, sucursal_counters está en 0.
    const a = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Folio 1',
      cost: 100,
    });
    const b = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Folio 2',
      cost: 100,
    });
    const c = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Folio 3',
      cost: 100,
    });

    // Formato esperado: <CODE>-NNNN. Verificamos que sea consecutivo.
    const folios = [a.folio, b.folio, c.folio];
    expect(folios.every((f) => /^[A-Z0-9]{2,4}-\d{4}$/.test(f))).toBe(true);

    const codes = folios.map((f) => f.split('-')[0]);
    expect(new Set(codes).size).toBe(1); // mismo prefix de sucursal

    const nums = folios.map((f) => parseInt(f.split('-')[1], 10));
    expect(nums[1]).toBe(nums[0] + 1);
    expect(nums[2]).toBe(nums[1] + 1);
  });

  test('down_payment cuenta como paid en v_order_balance', async ({ db }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Anticipo',
      cost: 1000,
      downPayment: 300,
    });

    const [bal] = await db.sql<
      { paid: number; balance: number; total: number }[]
    >`
      select paid::float as paid, balance::float as balance, total::float as total
      from public.v_order_balance where order_id = ${order.id}
    `;
    expect(bal.total).toBeCloseTo(1000);
    expect(bal.paid).toBeCloseTo(300);
    expect(bal.balance).toBeCloseTo(700);
  });

  test('cambio de status crea row en order_status_history', async ({ db }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Status',
      cost: 500,
    });

    // Trigger inicial: al insertar la orden, status='recibido' debió haber
    // generado una row en order_status_history (from_status null).
    const initialHistory = await db.sql<
      { from_status: string | null; to_status: string }[]
    >`
      select from_status, to_status::text as to_status
      from public.order_status_history
      where order_id = ${order.id}
      order by changed_at asc
    `;
    expect(initialHistory.length).toBeGreaterThanOrEqual(1);

    // Cambiar status: recibido -> en_diagnostico
    await db.sql`
      update public.orders set status = 'en_diagnostico' where id = ${order.id}
    `;

    // Y otra transición.
    await db.sql`
      update public.orders set status = 'reparado' where id = ${order.id}
    `;

    const finalHistory = await db.sql<
      { from_status: string | null; to_status: string }[]
    >`
      select from_status::text as from_status, to_status::text as to_status
      from public.order_status_history
      where order_id = ${order.id}
      order by changed_at asc
    `;

    // Debe haber al menos 2 transiciones registradas además del row inicial.
    expect(finalHistory.length).toBeGreaterThanOrEqual(initialHistory.length + 2);

    // Las últimas dos deben coincidir con los UPDATEs.
    const last = finalHistory[finalHistory.length - 1];
    const prev = finalHistory[finalHistory.length - 2];
    expect(prev.to_status).toBe('en_diagnostico');
    expect(last.from_status).toBe('en_diagnostico');
    expect(last.to_status).toBe('reparado');
  });

  test('UI — crear orden vía formulario produce row con folio', async ({ window, db }) => {
    // Necesitamos un cliente preexistente porque el combobox sólo permite
    // elegir uno (o crear uno via dialog, pero ese flow tiene su propia UX).
    const [customer] = await db.sql<{ id: string }[]>`
      insert into public.customers (sucursal_id, name, phone)
      values (${env.sucursalId}, 'Cliente UI Orders', '5555000000')
      returning id
    `;

    await navigateHash(window, '/reparaciones/nueva');

    // Combobox: click para abrir, luego elegir el cliente por su nombre.
    await window.getByRole('button', { name: /selecciona un cliente/i }).click();
    await window.getByRole('option', { name: /cliente ui orders/i }).click();

    // Datos del equipo.
    await window.getByLabel(/^marca$/i).fill('Apple');
    await window.getByLabel(/^modelo$/i).fill('iPhone 13');
    await window.getByLabel(/problema reportado/i).fill('No carga');

    // Costo.
    await window.getByLabel(/^costo$/i).fill('1500');

    // Submit.
    await window.getByRole('button', { name: /^guardar$/i }).click();

    // Toast de éxito ("Orden #X-NNNN creada") confirma el redirect.
    await expect(window.getByText(/orden #.+ creada/i)).toBeVisible({
      timeout: 5_000,
    });

    // Verificar en DB.
    const [orderRow] = await db.sql<
      { folio: string; cost: number; status: string; brand: string }[]
    >`
      select folio, cost::float as cost, status::text as status, brand
      from public.orders
      where customer_id = ${customer.id}
      order by created_at desc limit 1
    `;
    expect(orderRow.brand).toBe('Apple');
    expect(orderRow.cost).toBeCloseTo(1500);
    expect(/^[A-Z0-9]{2,4}-\d{4}$/.test(orderRow.folio)).toBe(true);
    // Status default es 'pendiente' (form.defaultValues).
    expect(['pendiente', 'recibido']).toContain(orderRow.status);
  });
});
