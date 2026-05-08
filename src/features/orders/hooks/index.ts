/**
 * Barrel re-export para mantener compatibilidad con `import from '@/features/orders/hooks'`.
 * El archivo original `orders/hooks.ts` se dividió en sub-archivos por dominio:
 *  - queries.ts   — queries de OS (lista, detalle, agenda, overdue) + sanitize helpers
 *  - mutations.ts — useSaveRepairOrder, useSaveItemOrder, useDeleteOrder, useUpdateOrderStatus
 *  - diagnosis.ts — useSaveDiagnosis (tecnico)
 */
export * from './queries';
export * from './mutations';
export * from './diagnosis';
