/**
 * Barrel re-export para mantener compatibilidad con `import from '@/features/cash/hooks'`.
 * El archivo original `cash/hooks.ts` se dividió en sub-archivos por dominio:
 *  - cashSession.ts  — sesión de caja + day-balance
 *  - sales.ts        — ventas (queries + create/cancel)
 *  - orderPayments.ts — abonos a OS + picker de cobros
 *  - saleReturns.ts  — split-tender payments + devoluciones parciales
 */
export * from './cashSession';
export * from './sales';
export * from './orderPayments';
export * from './saleReturns';
