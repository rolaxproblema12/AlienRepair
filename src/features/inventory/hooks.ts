import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { CategoryInput, MovementInput, ProductInput } from './schemas';
import type {
  ProductCategory,
  ProductMovement,
  ProductWithCategory,
} from './types';

const PRODUCT_COLUMNS = `
  id, sku, barcode, name, description, category_id, brand, model, supplier,
  cost_price, sale_price, iva_rate, stock, min_stock, notes, active,
  created_at, updated_at, created_by, updated_by,
  category:product_categories(id, name, color)
`;

// =====================================================
// Categorías
// =====================================================

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
    staleTime: 5 * 60_000,
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
      qc.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}

// =====================================================
// Productos
// =====================================================

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
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as ProductWithCategory;
    },
    enabled: !!id,
    staleTime: 60_000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['product-movements'] });
      qc.invalidateQueries({ queryKey: ['inventory-utility'] });
    },
  });
}

export function useDeleteProduct() {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// =====================================================
// Movimientos
// =====================================================

export function useProductMovements(productId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['product-movements', sucursalId, productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_movements')
        .select(
          'id, product_id, kind, quantity, unit_sale_price, unit_cost_price, reason, reference, created_at, created_by',
        )
        .eq('product_id', productId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ProductMovement[];
    },
    enabled: !!productId,
  });
}

export function useRecordMovement(productId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MovementInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // Para snapshot de venta, leer precios actuales
      let unit_sale_price: number | null = null;
      let unit_cost_price: number | null = null;
      if (values.kind === 'salida') {
        const { data: p, error: pErr } = await supabase
          .from('products')
          .select('sale_price, cost_price')
          .eq('id', productId)
          .single();
        if (pErr) throw pErr;
        unit_sale_price = Number(p.sale_price);
        unit_cost_price = Number(p.cost_price);
      }

      const absQty = Math.abs(values.quantity);
      let signed: number;
      if (values.kind === 'entrada') signed = absQty;
      else if (values.kind === 'salida') signed = -absQty;
      else signed = values.quantity; // ajuste — el signo lo decide el usuario

      const { data, error } = await supabase
        .from('product_movements')
        .insert({
          product_id: productId,
          sucursal_id: sucursalId,
          kind: values.kind,
          quantity: signed,
          unit_sale_price,
          unit_cost_price,
          reason: values.reason ?? null,
          reference: values.reference ?? null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProductMovement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['product-movements'] });
      qc.invalidateQueries({ queryKey: ['inventory-utility'] });
    },
  });
}

// =====================================================
// Importación CSV (bulk insert en chunks)
// =====================================================

export interface CsvProductRow {
  sku: string;
  name: string;
  category: string;
  cost_price: number;
  sale_price: number;
  iva_rate?: number;
  barcode?: string | null;
  brand?: string | null;
  model?: string | null;
  supplier?: string | null;
  min_stock?: number | null;
  initial_stock?: number;
  notes?: string | null;
}

export function useImportProductsCsv() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CsvProductRow[]) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // 1. resolver categorías por nombre, auto-crear las que falten (en esta sucursal)
      const uniqueCategoryNames = Array.from(
        new Set(rows.map((r) => r.category.trim()).filter(Boolean)),
      );
      const { data: existing, error: catErr } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('sucursal_id', sucursalId)
        .in('name', uniqueCategoryNames);
      if (catErr) throw catErr;
      const catMap = new Map<string, string>();
      (existing ?? []).forEach((c: { id: string; name: string }) =>
        catMap.set(c.name, c.id),
      );
      const missing = uniqueCategoryNames.filter((n) => !catMap.has(n));
      if (missing.length) {
        const { data: created, error: createErr } = await supabase
          .from('product_categories')
          .insert(missing.map((name) => ({ name, sucursal_id: sucursalId, created_by: userId })))
          .select('id, name');
        if (createErr) throw createErr;
        (created ?? []).forEach((c: { id: string; name: string }) =>
          catMap.set(c.name, c.id),
        );
      }

      // 2. preparar payloads de productos (sin initial_stock)
      const products = rows.map((r) => ({
        sku: r.sku.trim(),
        name: r.name.trim(),
        sucursal_id: sucursalId,
        category_id: catMap.get(r.category.trim())!,
        cost_price: r.cost_price,
        sale_price: r.sale_price,
        iva_rate: r.iva_rate ?? 0.16,
        barcode: r.barcode || null,
        brand: r.brand || null,
        model: r.model || null,
        supplier: r.supplier || null,
        min_stock: r.min_stock ?? null,
        notes: r.notes || null,
        created_by: userId,
        updated_by: userId,
      }));

      // 3. insertar en chunks de 50.
      //    Si un chunk falla, reintentamos fila por fila para identificar
      //    exactamente cuál(es) provocaron el error y reportar el índice
      //    global en el CSV original (no el del chunk).
      const errors: { row: number; sku: string; error: string }[] = [];
      const created: { id: string; sku: string }[] = [];
      const CHUNK = 50;
      for (let i = 0; i < products.length; i += CHUNK) {
        const slice = products.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('products')
          .insert(slice)
          .select('id, sku');
        if (error) {
          for (let j = 0; j < slice.length; j++) {
            const single = slice[j];
            const { data: one, error: errOne } = await supabase
              .from('products')
              .insert(single)
              .select('id, sku')
              .single();
            if (errOne) {
              errors.push({
                row: i + j + 1,
                sku: single.sku,
                error: errOne.message,
              });
            } else if (one) {
              created.push(one);
            }
          }
        } else if (data) {
          created.push(...data);
        }
      }

      // 4. para los productos creados con initial_stock > 0, crear movimientos entrada
      const skuToInitial = new Map<string, number>();
      for (const r of rows) {
        if (r.initial_stock && r.initial_stock > 0) {
          skuToInitial.set(r.sku.trim(), r.initial_stock);
        }
      }
      const movements = created
        .filter((c) => skuToInitial.has(c.sku))
        .map((c) => ({
          product_id: c.id,
          sucursal_id: sucursalId,
          kind: 'entrada' as const,
          quantity: skuToInitial.get(c.sku)!,
          reason: 'Stock inicial',
          created_by: userId,
        }));
      if (movements.length) {
        const { error: mvErr } = await supabase.from('product_movements').insert(movements);
        if (mvErr) errors.push({ row: -1, error: `Movimientos: ${mvErr.message}` });
      }

      return { created: created.length, errors };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}

// =====================================================
// Reporte de utilidades
// =====================================================

export interface UtilityRow {
  product_id: string;
  product_name: string;
  category_name: string | null;
  units_sold: number;
  utility_total: number;
}

export function useInventoryUtility(from: string, to: string) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['inventory-utility', sucursalId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_movements')
        .select(
          'product_id, quantity, unit_sale_price, unit_cost_price, products(name, category:product_categories(name))',
        )
        .eq('sucursal_id', sucursalId)
        .eq('kind', 'salida')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`)
        .not('unit_sale_price', 'is', null)
        .not('unit_cost_price', 'is', null);
      if (error) throw error;

      const map = new Map<string, UtilityRow>();
      let total = 0;
      for (const m of data ?? []) {
        const row = m as unknown as {
          product_id: string;
          quantity: number;
          unit_sale_price: number;
          unit_cost_price: number;
          products: { name: string; category: { name: string } | null } | null;
        };
        const units = Math.abs(row.quantity);
        const utility = units * (Number(row.unit_sale_price) - Number(row.unit_cost_price));
        total += utility;
        const existing = map.get(row.product_id);
        if (existing) {
          existing.units_sold += units;
          existing.utility_total += utility;
        } else {
          map.set(row.product_id, {
            product_id: row.product_id,
            product_name: row.products?.name ?? '—',
            category_name: row.products?.category?.name ?? null,
            units_sold: units,
            utility_total: utility,
          });
        }
      }
      const byProduct = Array.from(map.values()).sort(
        (a, b) => b.utility_total - a.utility_total,
      );
      return { total, byProduct };
    },
    staleTime: 60_000,
  });
}
