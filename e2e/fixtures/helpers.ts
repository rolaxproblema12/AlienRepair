import type { Page } from '@playwright/test';

/**
 * Navega a una ruta dentro de la app de Electron empacada. No podemos usar
 * page.goto('http://localhost/#/...') porque el renderer corre desde file://;
 * en su lugar mutamos location.hash y dejamos que React Router lo procese.
 */
export async function navigateHash(window: Page, hashPath: string): Promise<void> {
  await window.evaluate((p) => {
    window.location.hash = p;
  }, hashPath);
  // Pequeña espera para que el router monte la ruta antes de que el spec
  // empiece a interactuar con la nueva pantalla.
  await window.waitForTimeout(50);
}
