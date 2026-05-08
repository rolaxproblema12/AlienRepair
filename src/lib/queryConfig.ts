/**
 * staleTime tiers para React Query.
 *
 * Antes había magic numbers (15_000, 30_000, 60_000, 5 * 60_000, etc.)
 * repartidos sin criterio. Estas constantes son la fuente única de verdad —
 * cualquier hook nuevo debe elegir uno de estos tiers en lugar de inventar
 * su propio número.
 *
 * Criterio:
 *   REALTIME  — datos que el usuario espera ver "vivos" (cada venta los toca).
 *   FAST      — data transaccional que cambia varias veces por sesión.
 *   MEDIUM    — detalle / listas que cambian de vez en cuando.
 *   SLOW      — config / catálogos que cambian raramente.
 *   VERY_SLOW — catálogos externos / data prácticamente estática.
 *
 * El default global de queryClient.ts es 60_000 (== MEDIUM).
 */
export const STALE_TIMES = {
  REALTIME: 15_000,
  FAST: 30_000,
  MEDIUM: 60_000,
  SLOW: 5 * 60_000,
  VERY_SLOW: 60 * 60 * 1000,
} as const;

export type StaleTime = (typeof STALE_TIMES)[keyof typeof STALE_TIMES];
