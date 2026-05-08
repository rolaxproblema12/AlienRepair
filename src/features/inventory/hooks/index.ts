/**
 * Barrel re-export para mantener compatibilidad con `import from '@/features/inventory/hooks'`.
 * El archivo original `inventory/hooks.ts` se dividió en sub-archivos por dominio:
 *  - categories.ts        — categorías de productos
 *  - products.ts          — productos (queries + mutations + barcode lookup)
 *  - productMovements.ts  — historial de movimientos de stock
 *  - productImport.ts     — bulk import desde CSV
 *  - inventoryUtility.ts  — reporte de utilidades por producto
 */
export * from './categories';
export * from './products';
export * from './productMovements';
export * from './productImport';
export * from './inventoryUtility';
