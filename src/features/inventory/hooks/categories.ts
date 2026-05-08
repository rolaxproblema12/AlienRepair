import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { CategoryInput } from '../schemas';
import type { ProductCategory } from '../types';

export function useCategories() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['product-categories', sucursalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, color, created_at, created_by')
        .eq('sucursal_id', sucursalId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductCategory[];
    },
    staleTime: STALE_TIMES.SLOW,
  });
}

export function useSaveCategory() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CategoryInput }) => {
      const { data: auth } = await supabase.auth.getUser();
      const payload = { name: values.name.trim(), color: values.color ?? null };
      if (id) {
        const { data, error } = await supabase
          .from('product_categories')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as ProductCategory;
      }
      const { data, error } = await supabase
        .from('product_categories')
        .insert({ ...payload, sucursal_id: sucursalId, created_by: auth.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as ProductCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-categories', sucursalId] });
    },
  });
}

export function useDeleteCategory() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-categories', sucursalId] });
    },
  });
}
