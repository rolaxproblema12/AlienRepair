import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SucursalState {
  currentSucursalId: string | null;
  setCurrentSucursalId: (id: string | null) => void;
}

// Primer (y por ahora único) store zustand del proyecto. El resto del estado
// es server state vía TanStack Query. Sucursal activa es genuinamente client
// state mutable global, así que justifica el store. `persist` lo serializa a
// localStorage bajo la key `alien:current-sucursal`.
export const useSucursalStore = create<SucursalState>()(
  persist(
    (set) => ({
      currentSucursalId: null,
      setCurrentSucursalId: (id) => set({ currentSucursalId: id }),
    }),
    { name: 'alien:current-sucursal' }
  )
);
