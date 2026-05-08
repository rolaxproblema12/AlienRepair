import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateProductRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { ProductInput } from '../schemas';
import type { ProductWithCategory } from '../types';

export const PRODUCT_COLUMNS = `
  id, sku, barcode, name, description, category_id, brand, model, supplier,
  cost_price, sale_price, iva_rate, stock, min_stock, notes, active,
  created_at, updated_at, created_by, updated_by,
  category:product_categories(id, name, color)
`;

interface ProductsFilter {
  search?: string;
  categoryId?: string | 'all';
  lowStock?: boolean;
  includeInactive?: boolean;
}

export function useProducts(filter: ProductsFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['products', sucursalId, filter],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('name', { ascending: true })
        .limit(500);

      if (!filter.includeInactive) q = q.eq('active', true);
      if (filter.categoryId && filter.categoryId !== 'all') {
        q = q.eq('category_id', filter.categoryId);
      }

      const term = filter.search?.trim() ?? '';
      if (term) {
        const safe = term.replace(/[,()]/g, ' ');
        const like = `%${safe}%`;
        const orParts = [
          `name.ilike.${like}`,
          `sku.ilike.${like}`,
          `brand.ilike.${like}`,
          `model.ilike.${like}`,
          `barcode.ilike.${like}`,
        ];
        q = q.or(orParts.join(','));
      }

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as ProductWithCategory[];
      if (filter.lowStock) {
        rows = rows.filter(
          (p) => p.min_stock != null && p.stock <= p.min_stock,
        );
      }
      return rows;
    },
  });
}

export function useProduct(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['product', sucursalId, id],
    queryFn: async () => {
      // Defensa en profundidad sobre RLS.
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', id!)
        .eq('sucursal_id', sucursalId)
        .single();
      if (error) throw error;
      return data as unknown as ProductWithCategory;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.MEDIUM,
  });
}

// Búsqueda por barcode usada en el flow de POS. Acepta sucursalId explícito
// porque se llama desde un callback (no es un hook). El caller debe pasarlo.
export async function findProductByBarcode(
  barcode: string,
  sucursalId: string,
): Promise<ProductWithCategory | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('sucursal_id', sucursalId)
    .eq('barcode', barcode)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProductWithCategory) ?? null;
}

export function useSaveProduct() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ProductInput }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const payload = {
        sku: values.sku.trim(),
        barcode: values.barcode ?? null,
        name: values.name.trim(),
        description: values.description ?? null,
        category_id: values.category_id,
        brand: values.brand ?? null,
        model: values.model ?? null,
        supplier: values.supplier ?? null,
        cost_price: values.cost_price,
        sale_price: values.sale_price,
        iva_rate: values.iva_rate,
        min_stock: values.min_stock ?? null,
        notes: values.notes ?? null,
        active: values.active,
      };

      if (id) {
        const { data, error } = await supabase
          .from('products')
          .update({ ...payload, updated_by: userId })
          .eq('id', id)
          .select(PRODUCT_COLUMNS)
          .single();
        if (error) throw error;
        return data as unknown as ProductWithCategory;
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: userId,
          updated_by: userId,
        })
        .select(PRODUCT_COLUMNS)
        .single();
      if (error) throw error;
      const product = data as unknown as ProductWithCategory;

      if (values.initial_stock && values.initial_stock > 0) {
        const { error: mvErr } = await supabase.from('product_movements').insert({
          product_id: product.id,
          sucursal_id: sucursalId,
          kind: 'entrada',
          quantity: values.initial_stock,
          reason: 'Stock inicial',
          created_by: userId,
        });
        if (mvErr) throw mvErr;
      }

      return product;
    },
    onSuccess: (data) => {
      invalidateProductRelated(qc, sucursalId, { productId: data.id });
    },
  });
}

export function useDeleteProduct() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete por defecto: si tiene movimientos, no se puede borrar (FK).
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidateProductRelated(qc, sucursalId, { productId: id });
    },
  });
}
