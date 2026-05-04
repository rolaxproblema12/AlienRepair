import { test, expect } from '../fixtures/electron';
import { seedProduct } from '../fixtures/db';
import { env } from '../fixtures/env';

test.describe('Cancelación de venta', () => {
  test('reverte stock vía trigger sales_cancel_reverse', async ({ window, db }) => {
    const product = await seedProduct(db.sql, env.sucursalId, {
      name: 'Cable USB-C',
      price: 80,
      stock: 3,
    });

    await window.goto('http://localhost/#/caja').catch(() => {});
    await window.getByRole('button', { name: /abrir caja/i }).click();
    await window.getByLabel(/monto inicial/i).fill('0');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // Vender 1
    await window.getByRole('link', { name: /nueva venta/i }).click();
    await window.getByPlaceholder(/buscar producto/i).fill('Cable USB');
    await window.getByText('Cable USB-C').click();
    await window.getByRole('button', { name: /cobrar/i }).click();

    // Stock pasó de 3 a 2 por la venta
    const [pre] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.products where id = ${product.id}
    `;
    expect(pre.stock).toBe(2);

    // Ir a la venta y cancelar
    const [sale] = await db.sql<{ id: string }[]>`
      select id from public.sales where sucursal_id = ${env.sucursalId}
      order by created_at desc limit 1
    `;
    await window.goto(`http://localhost/#/caja/${sale.id}`).catch(() => {});
    await window.getByRole('button', { name: /cancelar venta/i }).click();
    await window.getByLabel(/motivo/i).fill('cliente arrepentido');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // El trigger sales_cancel_reverse insertó product_movement de entrada,
    // y sync_product_stock devolvió el stock a 3.
    const [post] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.products where id = ${product.id}
    `;
    expect(post.stock).toBe(3);

    const [reversal] = await db.sql<{ kind: string; quantity: number }[]>`
      select kind, quantity::float as quantity from public.product_movements
      where product_id = ${product.id} order by created_at desc limit 1
    `;
    expect(reversal.kind).toBe('entrada');
    expect(reversal.quantity).toBeCloseTo(1);
  });
});
