import { test, expect } from '../fixtures/electron';
import { seedPart, seedOrder } from '../fixtures/db';
import { env } from '../fixtures/env';
import { navigateHash } from '../fixtures/helpers';

/**
 * Cubre el cálculo de saldo cuando se agregan piezas a una orden de
 * reparación. Estrellita por riesgo: la lógica vive en triggers SQL
 * (sync_part_stock + view v_order_balance) y un cambio en cualquiera
 * de los dos rompe los saldos del cobro en caja sin error visible.
 *
 * Cubrimos dos paths para detectar regresiones tanto en el trigger
 * como en el binding UI ↔ DB:
 *   1. SQL directo: insert en part_movements, leer v_order_balance.
 *   2. UI: AddPartToOrderDialog → submit → asserts en DB.
 */

test.describe('Saldo de orden con piezas (v_order_balance trigger)', () => {
  test('SQL — insert salida actualiza parts_total y total via trigger', async ({ db }) => {
    const part = await seedPart(db.sql, env.sucursalId, {
      name: 'Pantalla iPhone 14 Test',
      salePrice: 200,
      purchasePrice: 100,
      stock: 5,
    });
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Saldo Test',
      cost: 1000,
    });

    // Estado inicial: balance solo refleja el cost base.
    const [pre] = await db.sql<
      { base_cost: number; parts_total: number; total: number; balance: number }[]
    >`
      select base_cost::float as base_cost,
             parts_total::float as parts_total,
             total::float as total,
             balance::float as balance
      from public.v_order_balance where order_id = ${order.id}
    `;
    expect(pre.base_cost).toBeCloseTo(1000);
    expect(pre.parts_total).toBeCloseTo(0);
    expect(pre.total).toBeCloseTo(1000);
    expect(pre.balance).toBeCloseTo(1000);

    // Insertar salida (qty negativa por convención; ver useAddPartToOrder).
    await db.sql`
      insert into public.part_movements (
        sucursal_id, part_id, kind, quantity,
        unit_purchase_price, unit_sale_price, order_id
      )
      values (
        ${env.sucursalId}, ${part.id}, 'salida', -1,
        100, 200, ${order.id}
      )
    `;

    // Después: parts_total = 200, total = 1200, balance = 1200.
    const [post] = await db.sql<
      { parts_total: number; total: number; balance: number }[]
    >`
      select parts_total::float as parts_total,
             total::float as total,
             balance::float as balance
      from public.v_order_balance where order_id = ${order.id}
    `;
    expect(post.parts_total).toBeCloseTo(200);
    expect(post.total).toBeCloseTo(1200);
    expect(post.balance).toBeCloseTo(1200);

    // Stock decreció de 5 a 4 (sync_part_stock recalcula sum(movements)).
    const [stockRow] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.parts where id = ${part.id}
    `;
    expect(stockRow.stock).toBe(4);
  });

  test('SQL — segundo salida acumula correctamente', async ({ db }) => {
    const part = await seedPart(db.sql, env.sucursalId, {
      name: 'Batería 14 Acumula Test',
      category: 'bateria',
      salePrice: 50,
      purchasePrice: 25,
      stock: 10,
    });
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Acumula',
      cost: 500,
    });

    // Dos salidas: 1 unidad de $50 y 2 unidades de $50.
    await db.sql`
      insert into public.part_movements (
        sucursal_id, part_id, kind, quantity,
        unit_purchase_price, unit_sale_price, order_id
      )
      values
        (${env.sucursalId}, ${part.id}, 'salida', -1, 25, 50, ${order.id}),
        (${env.sucursalId}, ${part.id}, 'salida', -2, 25, 50, ${order.id})
    `;

    const [bal] = await db.sql<
      { parts_total: number; total: number }[]
    >`
      select parts_total::float as parts_total, total::float as total
      from public.v_order_balance where order_id = ${order.id}
    `;
    // 1*50 + 2*50 = 150
    expect(bal.parts_total).toBeCloseTo(150);
    expect(bal.total).toBeCloseTo(650);

    const [stockRow] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.parts where id = ${part.id}
    `;
    // 10 entrada - 1 - 2 = 7
    expect(stockRow.stock).toBe(7);
  });

  test('UI — agregar pieza vía AddPartToOrderDialog actualiza DB', async ({ window, db }) => {
    const part = await seedPart(db.sql, env.sucursalId, {
      name: 'Flexor UI Test',
      category: 'flexor',
      salePrice: 350,
      purchasePrice: 175,
      stock: 3,
    });
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente UI Pieza',
      cost: 800,
    });

    await navigateHash(window, `/reparaciones/${order.id}`);

    // El botón vive en OrderPartsSection.
    await window.getByRole('button', { name: /agregar pieza/i }).click();

    // Diálogo abre con buscador. Escribir y elegir.
    await window.getByPlaceholder(/buscar por nombre/i).fill('Flexor UI');
    await window.getByText('Flexor UI Test').click();

    // Form de cantidad/precio. Defaults: qty=1, unit_sale_price=cost_sale (350).
    await window.getByRole('button', { name: /agregar pieza/i }).click();

    // Esperar a que el toast confirme y la mutación termine.
    await expect(window.getByText(/pieza agregada a la orden/i)).toBeVisible({
      timeout: 5_000,
    });

    // Verificación en DB: movimiento creado, stock decreció, balance subió.
    const [mov] = await db.sql<
      { kind: string; quantity: number; unit_sale_price: number; sucursal_id: string }[]
    >`
      select kind, quantity::float as quantity,
             unit_sale_price::float as unit_sale_price,
             sucursal_id::text as sucursal_id
      from public.part_movements
      where part_id = ${part.id} and order_id = ${order.id}
      order by created_at desc limit 1
    `;
    expect(mov.kind).toBe('salida');
    expect(mov.quantity).toBe(-1);
    expect(mov.unit_sale_price).toBeCloseTo(350);
    // El trigger de propagación (0030) llena sucursal_id automáticamente.
    expect(mov.sucursal_id).toBe(env.sucursalId);

    const [stockRow] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.parts where id = ${part.id}
    `;
    expect(stockRow.stock).toBe(2); // 3 - 1

    const [bal] = await db.sql<
      { parts_total: number; total: number; balance: number }[]
    >`
      select parts_total::float as parts_total,
             total::float as total,
             balance::float as balance
      from public.v_order_balance where order_id = ${order.id}
    `;
    expect(bal.parts_total).toBeCloseTo(350);
    expect(bal.total).toBeCloseTo(1150); // 800 + 350
    expect(bal.balance).toBeCloseTo(1150);
  });
});
