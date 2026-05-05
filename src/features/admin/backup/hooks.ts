import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { downloadJson } from '@/lib/csv';
import packageJson from '../../../../package.json';

/**
 * Hook que descarga un dump JSON con todos los datos transaccionales y
 * de catálogo de la sucursal indicada. Es un export read-only — no hay
 * restore desde la app (eso lo hace Supabase nativo o un script aparte).
 *
 * El archivo resultante es portable: el shop owner puede llevárselo,
 * abrirlo con cualquier editor, importarlo a Excel, o usarlo como
 * evidencia auditable. Cada sección es un array — la estructura es
 * intencionalmente plana para que sea fácil de consumir.
 */
const TABLES = [
  'customers',
  'orders',
  'order_status_history',
  'order_payments',
  'products',
  'product_categories',
  'product_movements',
  'parts',
  'part_movements',
  'sales',
  'sale_items',
  'sale_returns',
  'expenses',
  'cash_sessions',
  'sucursal_settings',
] as const;

interface BackupBundle {
  version: string;
  exported_at: string;
  app_version: string;
  sucursal: unknown;
  data: Record<string, unknown[]>;
  counts: Record<string, number>;
}

export function useBackupExport() {
  return useMutation({
    mutationFn: async (sucursalId: string) => {
      // 1. Datos de la propia sucursal (1 row).
      const { data: sucursal, error: sucErr } = await supabase
        .from('sucursales')
        .select('*')
        .eq('id', sucursalId)
        .maybeSingle();
      if (sucErr) throw sucErr;
      if (!sucursal) throw new Error('Sucursal no encontrada');

      // 2. Querear todas las tablas en paralelo. Las que tengan RLS por
      //    sucursal_id la respetan automáticamente; sucursal_settings tiene
      //    su propia policy. Si una tabla no existe (ej: sale_returns antes
      //    de aplicar 0035), se ignora con error log y sigue.
      const data: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      const errors: string[] = [];

      await Promise.all(
        TABLES.map(async (table) => {
          const { data: rows, error } = await supabase
            .from(table)
            .select('*')
            .eq('sucursal_id', sucursalId);
          if (error) {
            errors.push(`${table}: ${error.message}`);
            data[table] = [];
            counts[table] = 0;
            return;
          }
          data[table] = rows ?? [];
          counts[table] = rows?.length ?? 0;
        }),
      );

      const bundle: BackupBundle = {
        version: '1',
        exported_at: new Date().toISOString(),
        app_version: packageJson.version,
        sucursal,
        data,
        counts,
      };

      const code = (sucursal as { code?: string }).code ?? 'sucursal';
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`backup-${code}-${stamp}.json`, bundle);

      return { bundle, errors };
    },
  });
}
