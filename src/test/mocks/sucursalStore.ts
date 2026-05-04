import { vi } from 'vitest';

export const TEST_SUCURSAL_ID = '00000000-0000-0000-0000-000000000001';

export function mockSucursalStore(sucursalId: string | null = TEST_SUCURSAL_ID) {
  return {
    useSucursalStore: vi.fn(() => sucursalId),
    useScopedSucursalId: vi.fn(() => {
      if (!sucursalId) throw new Error('No hay sucursal activa');
      return sucursalId;
    }),
    useMaybeSucursalId: vi.fn(() => sucursalId),
  };
}
