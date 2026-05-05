import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Sucursal, SucursalSetting } from '@/features/sucursales/types';
import type { SucursalConfigInput } from './schemas';

const SUCURSAL_COLUMNS =
  'id, code, name, address, phone, active, created_at, updated_at, rfc, email, web, logo_url, warranty_message, warranty_days';

// Lee la fila completa de una sucursal — todos los campos editables en
// la página de configuración. Distinta de useCurrentSucursal porque acá
// queremos el state freshest del server (post-edit).
export function useSucursalConfig(sucursalId: string | null | undefined) {
  return useQuery({
    queryKey: ['sucursal-config', sucursalId],
    enabled: !!sucursalId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select(SUCURSAL_COLUMNS)
        .eq('id', sucursalId!)
        .single();
      if (error) throw error;
      return data as Sucursal;
    },
  });
}

export function useUpdateSucursalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; values: SucursalConfigInput }) => {
      const { data, error } = await supabase
        .from('sucursales')
        .update(input.values)
        .eq('id', input.id)
        .select(SUCURSAL_COLUMNS)
        .single();
      if (error) throw error;
      return data as Sucursal;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['sucursal-config', vars.id] });
      qc.invalidateQueries({ queryKey: ['admin', 'sucursales'] });
      qc.invalidateQueries({ queryKey: ['user-sucursales'] });
    },
  });
}

// Settings tipo key/value de una sucursal (plantillas WhatsApp, etc.).
export function useSucursalSettings(sucursalId: string | null | undefined) {
  return useQuery({
    queryKey: ['sucursal-settings', sucursalId],
    enabled: !!sucursalId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursal_settings')
        .select('sucursal_id, key, value, updated_at')
        .eq('sucursal_id', sucursalId!);
      if (error) throw error;
      return (data ?? []) as SucursalSetting[];
    },
  });
}

// Helper para convertir el array de settings en un map por key — más
// cómodo de consumir en componentes.
export function useSucursalSettingsMap(sucursalId: string | null | undefined) {
  const q = useSucursalSettings(sucursalId);
  const map = new Map<string, string>();
  for (const s of q.data ?? []) map.set(s.key, s.value);
  return { ...q, map };
}

export function useUpsertSucursalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sucursalId: string;
      entries: { key: string; value: string }[];
    }) => {
      // Filtrar values vacíos: si el admin borra el textarea queremos eliminar
      // el setting (no persistir cadena vacía que confunda al fallback).
      const toUpsert = input.entries.filter((e) => e.value.trim() !== '');
      const toDelete = input.entries
        .filter((e) => e.value.trim() === '')
        .map((e) => e.key);

      if (toUpsert.length) {
        const { error } = await supabase.from('sucursal_settings').upsert(
          toUpsert.map((e) => ({
            sucursal_id: input.sucursalId,
            key: e.key,
            value: e.value,
          })),
          { onConflict: 'sucursal_id,key' },
        );
        if (error) throw error;
      }
      if (toDelete.length) {
        const { error } = await supabase
          .from('sucursal_settings')
          .delete()
          .eq('sucursal_id', input.sucursalId)
          .in('key', toDelete);
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['sucursal-settings', vars.sucursalId] });
    },
  });
}
