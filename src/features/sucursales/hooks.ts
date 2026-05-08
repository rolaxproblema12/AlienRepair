import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSucursalStore } from '@/lib/sucursalStore';
import type { Sucursal } from './types';
import type { SucursalInput } from './schemas';

const SUCURSAL_COLUMNS =
  'id, code, name, address, phone, active, created_at, updated_at, rfc, email, web, logo_url, warranty_message, warranty_days';

// Lista las sucursales que el usuario actual puede operar.
// RLS: la tabla `sucursales` filtra por user_can_access_sucursal(id), así que
// admin recibe TODAS y operador recibe solo las asignadas en user_sucursales.
export function useUserSucursales() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  return useQuery({
    queryKey: ['user-sucursales', userId],
    enabled: !!userId,
    staleTime: STALE_TIMES.MEDIUM,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select(SUCURSAL_COLUMNS)
        .eq('active', true)
        .order('code', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Sucursal[];
    },
  });
}

// Combina el store con la lista de sucursales accesibles. SOLO devuelve
// `current` si la sucursal está realmente reflejada en el store — si no
// retorna null y dispara un useEffect que sincroniza el store con la primera
// disponible. Esto evita el race donde un consumidor lee `current` truthy
// pero `useScopedSucursalId` aún ve el store en null y tira.
export function useCurrentSucursal() {
  const { data: sucursales = [], isLoading } = useUserSucursales();
  const currentId = useSucursalStore((s) => s.currentSucursalId);
  const setCurrentId = useSucursalStore((s) => s.setCurrentSucursalId);

  // Bootstrap: si el store está vacío o apunta a una sucursal que ya no
  // existe, asignar la primera disponible. Corre en useEffect (post-commit),
  // así que durante ese render `current` queda null.
  useEffect(() => {
    if (isLoading) return;
    if (!sucursales.length) {
      // Si el store apunta a una sucursal que ya no es accesible, limpiar.
      if (currentId) setCurrentId(null);
      return;
    }
    const stillValid = sucursales.some((s) => s.id === currentId);
    if (!stillValid) {
      setCurrentId(sucursales[0].id);
    }
  }, [isLoading, sucursales, currentId, setCurrentId]);

  // `current` solo es truthy cuando el store y la lista están sincronizados.
  // Si no, devolvemos null para que el caller espere el siguiente render.
  const current = useMemo(() => {
    if (!currentId) return null;
    return sucursales.find((s) => s.id === currentId) ?? null;
  }, [sucursales, currentId]);

  return { current, sucursales, isLoading };
}

// Wrapper que cambia la sucursal y purga toda la caché de queries dependientes.
// Se llama desde el SucursalSelector y desde flows que necesiten "saltar" de sucursal.
export function useSetCurrentSucursal() {
  const setCurrentId = useSucursalStore((s) => s.setCurrentSucursalId);
  const qc = useQueryClient();
  return (id: string) => {
    setCurrentId(id);
    // Invalidar todo lo que depende del scope de sucursal. Por ahora solo
    // existe `user-sucursales`; cuando hooks de features incluyan sucursal_id
    // en sus keys, esta invalidación los refrescará automáticamente.
    qc.invalidateQueries();
  };
}

// =====================================================
// Admin: CRUD de sucursales
// =====================================================
export function useAdminSucursales() {
  return useQuery({
    queryKey: ['admin', 'sucursales'],
    staleTime: STALE_TIMES.FAST,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select(SUCURSAL_COLUMNS)
        .order('code', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Sucursal[];
    },
  });
}

export function useSaveSucursal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SucursalInput & { id?: string }) => {
      const payload = {
        code: input.code,
        name: input.name,
        address: input.address,
        phone: input.phone,
        active: input.active,
      };
      const q = input.id
        ? supabase
            .from('sucursales')
            .update(payload)
            .eq('id', input.id)
            .select(SUCURSAL_COLUMNS)
            .single()
        : supabase.from('sucursales').insert(payload).select(SUCURSAL_COLUMNS).single();
      const { data, error } = await q;
      if (error) throw error;
      return data as Sucursal;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sucursales'] });
      qc.invalidateQueries({ queryKey: ['user-sucursales'] });
    },
  });
}

// =====================================================
// Admin: asignación usuario ↔ sucursal
// =====================================================
export interface UserSucursalRow {
  user_id: string;
  sucursal_id: string;
}

export function useUserSucursalAssignments(userId?: string) {
  return useQuery({
    queryKey: ['admin', 'user-sucursal-assignments', userId],
    enabled: !!userId,
    staleTime: STALE_TIMES.FAST,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sucursales')
        .select('user_id, sucursal_id')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data ?? []) as UserSucursalRow[];
    },
  });
}

// Conteo de sucursales asignadas por usuario. Solo admin (RLS bloquea otros).
// Usado en UsersPage para advertir cuando un operador queda sin acceso real.
export function useAllUserSucursalCounts() {
  return useQuery({
    queryKey: ['admin', 'user-sucursal-counts'],
    staleTime: STALE_TIMES.FAST,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sucursales')
        .select('user_id, sucursal_id');
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as UserSucursalRow[]) {
        counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
      }
      return counts;
    },
  });
}

export function useAssignUserToSucursal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; sucursalId: string }) => {
      const { error } = await supabase
        .from('user_sucursales')
        .insert({ user_id: input.userId, sucursal_id: input.sucursalId });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-sucursal-assignments', vars.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-sucursal-counts'] });
      qc.invalidateQueries({ queryKey: ['user-sucursales'] });
    },
  });
}

export function useUnassignUserFromSucursal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; sucursalId: string }) => {
      const { error } = await supabase
        .from('user_sucursales')
        .delete()
        .eq('user_id', input.userId)
        .eq('sucursal_id', input.sucursalId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-sucursal-assignments', vars.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-sucursal-counts'] });
      qc.invalidateQueries({ queryKey: ['user-sucursales'] });
    },
  });
}
