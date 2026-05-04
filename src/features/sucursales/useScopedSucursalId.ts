import { useSucursalStore } from '@/lib/sucursalStore';

// Hook que devuelve el id de sucursal activa, lanzando si no hay ninguno.
// Lo usan TODOS los hooks que leen/escriben datos transaccionales (orders,
// products, sales, etc.) para incluir sucursal_id en query keys e inserts.
//
// El throw es intencional: si un componente que depende de scope se renderiza
// sin sucursal activa, queremos un error claro en vez de queries silenciosamente
// rotas. AuthProvider/AuthGate garantizan que ningún componente protegido se
// monte sin sucursal activa, así que en práctica nunca debería disparar.
export function useScopedSucursalId(): string {
  const id = useSucursalStore((s) => s.currentSucursalId);
  if (!id) {
    throw new Error(
      'useScopedSucursalId: no hay sucursal activa. ' +
        'Esto indica que un componente scopeado se renderizó antes que AuthProvider establezca la sucursal default.'
    );
  }
  return id;
}

// Variante "soft" que devuelve null en vez de tirar. Útil para queries que
// usan `enabled: !!sucursalId` y prefieren no ejecutarse a tirar.
export function useMaybeSucursalId(): string | null {
  return useSucursalStore((s) => s.currentSucursalId);
}
