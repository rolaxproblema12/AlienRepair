import { test, expect } from '../fixtures/electron';
import { seedProduct } from '../fixtures/db';
import { env } from '../fixtures/env';

test.describe('Venta de producto en POS', () => {
  test('crea venta, decreta stock vía trigger SQL, deja registro de movimiento', async ({
    window,
    db,
  }) => {
    const product = await seedProduct(db.sql, env.sucursalId, {
      name: 'Cargador iPhone',
      price: 250,
      stock: 5,
    });

    // Abrir caja con $0
    await window.goto('http://localhost/#/caja').catch(() => {});
    await window.getByRole('button', { name: /abrir caja/i }).click();
    await window.getByLabel(/monto inicial/i).fill('0');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // Nueva venta
    await window.getByRole('link', { name: /nueva venta/i }).click();
    await window.getByPlaceholder(/buscar producto/i).fill('Cargador');
    await window.getByText('Cargador iPhone').click();
    await window.getByRole('button', { name: /cobrar/i }).click();

    // Verificar en DB que la venta + sale_items existen
    const [sale] = await db.sql<{ id: string; total: number; status: string }[]>`
      select id, total::float as total, status from public.sales
      where sucursal_id = ${env.sucursalId} order by created_at desc limit 1
    `;
    expect(sale.status).toBe('completada');
    expect(sale.total).toBeCloseTo(250);

    // Trigger sale_item_register_movement debió crear product_movement de salida
    const [mov] = await db.sql<{ kind: string; quantity: number }[]>`
      select kind, quantity::float as quantity from public.product_movements
      where product_id = ${product.id} order by created_at desc limit 1
    `;
    expect(mov.kind).toBe('salida');
    expect(mov.quantity).toBeCloseTo(1);

    // Stock decreció (sync_product_stock trigger)
    const [p] = await db.sql<{ stock: number }[]>`
      select stock::float as stock from public.products where id = ${product.id}
    `;
    expect(p.stock).toBe(4);
  });
});
