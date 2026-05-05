import { test, expect } from '../fixtures/electron';
import { seedProduct } from '../fixtures/db';
import { env } from '../fixtures/env';
import { navigateHash } from '../fixtures/helpers';

/**
 * Race entre la validación client-side de stock y el trigger
 * `prevent_negative_stock`. El cart guarda un snapshot de
 * `stock_available` cuando se agrega el producto; si entre ese momento
 * y el submit alguien más drena el stock (otra sucursal, otro user),
 * el trigger SQL rechaza.
 *
 * NewSalePage debe mostrar un toast legible en ese caso, no el
 * error técnico crudo del trigger ("Stock insuficiente: hay 0
 * unidades, intentas sacar 1").
 */
test.describe('Venta — race de stock entre client y trigger SQL', () => {
  test('toast legible cuando el stock se vacía entre cart y cobro', async ({
    window,
    db,
  }) => {
    const product = await seedProduct(db.sql, env.sucursalId, {
      name: 'Auricular Bluetooth',
      price: 350,
      stock: 1,
    });

    // Abrir caja
    await navigateHash(window, '/caja');
    await window.getByRole('button', { name: /abrir caja/i }).click();
    await window.getByLabel(/monto inicial/i).fill('0');
    await window.getByRole('button', { name: /confirmar/i }).click();

    // Nueva venta + agregar al cart (snapshotea stock_available=1)
    await window.getByRole('link', { name: /nueva venta/i }).click();
    await window.getByPlaceholder(/buscar producto/i).fill('Auricular');
    await window.getByText('Auricular Bluetooth').click();

    // Drenar stock por fuera (simulando otra sucursal/user vendiendo el
    // último). NO insertamos un movimiento — solo bajamos products.stock
    // a 0 directo, suficiente para que prevent_negative_stock rechace
    // el siguiente salida.
    await db.sql`
      update public.products set stock = 0 where id = ${product.id}
    `;

    // Click cobrar — el trigger SQL debe rechazar y la UI mostrar el
    // toast legible que metimos en NewSalePage.
    await window.getByRole('button', { name: /cobrar/i }).click();

    // El toast contiene 'Stock insuficiente al registrar' y mencionan
    // que otra venta consumió el producto.
    await expect(
      window.getByText(/stock insuficiente al registrar/i),
    ).toBeVisible();

    // Sanity: NO se creó la venta (el rollback del frontend la borra
    // si falla la inserción de items, pero acá la venta ni siquiera se
    // crea porque el trigger rechaza dentro de la transacción).
    const sales = await db.sql<{ id: string }[]>`
      select id from public.sales where sucursal_id = ${env.sucursalId}
    `;
    expect(sales).toHaveLength(0);
  });
});
