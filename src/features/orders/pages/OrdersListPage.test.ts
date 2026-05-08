import { describe, expect, it } from 'vitest';
import { KANBAN_GRID_CLASSES } from './OrdersListPage';
import { ORDER_STATUSES } from '@/features/orders/types';

/**
 * Test de regresión visual del layout responsivo del kanban.
 * Si alguien rompe los breakpoints (típicamente al refactorear o copiar/pegar
 * Tailwind classes) este test falla y obliga a justificar el cambio.
 */
describe('OrdersListPage / kanban layout', () => {
  const tokens = KANBAN_GRID_CLASSES.split(/\s+/);

  it('declara grid base con auto-rows-min y items-start', () => {
    expect(tokens).toContain('grid');
    expect(tokens).toContain('auto-rows-min');
    expect(tokens).toContain('items-start');
  });

  it('cubre 4 breakpoints: 1, 2, 3 y 6 columnas', () => {
    expect(tokens).toContain('grid-cols-1');
    expect(tokens).toContain('sm:grid-cols-2');
    expect(tokens).toContain('lg:grid-cols-3');
    expect(tokens).toContain('xl:grid-cols-6');
  });

  it('xl:grid-cols-6 coincide con la cantidad de status (una columna por status)', () => {
    expect(ORDER_STATUSES).toHaveLength(6);
    expect(tokens).toContain('xl:grid-cols-6');
  });

  it('mantiene padding y gap consistentes', () => {
    expect(tokens).toContain('px-8');
    expect(tokens).toContain('py-6');
    expect(tokens).toContain('gap-4');
  });
});
