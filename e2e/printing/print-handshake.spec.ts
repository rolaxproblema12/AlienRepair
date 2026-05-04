import { test, expect } from '../fixtures/electron';
import { seedOrder } from '../fixtures/db';
import { env } from '../fixtures/env';
import { navigateHash } from '../fixtures/helpers';

/**
 * Cubre el flow de impresión del lado del renderer.
 *
 * El bug que vigilamos: si el template no llega a montarse o no llama
 * `notifyPrintReady`, el main process imprime tras el timeout de 5s
 * con la página todavía en blanco (ver electron/main.ts ~L260).
 *
 * Como proxy de "el handshake va a dispararse a tiempo" verificamos:
 *   1. La página carga la data (renderiza el folio + datos).
 *   2. body recibe la clase `print-{carta|termica}-page` que el template
 *      agrega en useEffect *justo antes* de llamar notifyPrintReady. Si
 *      la clase aparece, la siguiente línea programa el ready.
 *
 * No podemos interceptar la llamada IPC directamente (contextBridge
 * sella `window.alien`), pero monitorear esta clase es suficientemente
 * preciso: cubre la ventana entre "data lista" y "ready emitido".
 */

test.describe('Print handshake — order template', () => {
  test('variant carta renderiza datos y agrega body class', async ({ window, db }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Print Carta',
      cost: 750,
    });

    await navigateHash(window, `/print/order/${order.id}?size=carta`);

    // Body class agregado por PrintOrderPage useEffect cuando order.data llega.
    await expect.poll(
      () => window.evaluate(() => document.body.classList.contains('print-carta-page')),
      { timeout: 5_000 },
    ).toBe(true);

    // El template muestra el folio en algún lado del documento.
    await expect(window.locator(`text=${order.folio}`).first()).toBeVisible();
  });

  test('variant termica usa la clase termica', async ({ window, db }) => {
    const order = await seedOrder(db.sql, env.sucursalId, {
      customerName: 'Cliente Print Termica',
      cost: 250,
    });

    await navigateHash(window, `/print/order/${order.id}?size=termica`);

    await expect.poll(
      () => window.evaluate(() => document.body.classList.contains('print-termica-page')),
      { timeout: 5_000 },
    ).toBe(true);

    // No debe tener la clase de carta simultáneamente.
    const hasCarta = await window.evaluate(() =>
      document.body.classList.contains('print-carta-page'),
    );
    expect(hasCarta).toBe(false);

    await expect(window.locator(`text=${order.folio}`).first()).toBeVisible();
  });

  test('orden inexistente muestra fallback "no encontrada" en lugar de imprimir blanco', async ({
    window,
  }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await navigateHash(window, `/print/order/${fakeId}?size=carta`);

    await expect(window.getByText(/orden no encontrada/i)).toBeVisible({
      timeout: 5_000,
    });

    // No debe haber agregado la clase de print — es fallback, no template.
    const hasClass = await window.evaluate(
      () =>
        document.body.classList.contains('print-carta-page') ||
        document.body.classList.contains('print-termica-page'),
    );
    expect(hasClass).toBe(false);
  });
});
