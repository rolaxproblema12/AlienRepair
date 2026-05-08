import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateProductRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';

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
      invalidateProductRelated(qc, sucursalId);
      qc.invalidateQueries({ queryKey: ['product-categories', sucursalId] });
    },
  });
}
