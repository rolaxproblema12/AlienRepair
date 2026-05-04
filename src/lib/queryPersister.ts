/**
 * Persistencia de cache de React Query en IndexedDB.
 *
 * MVP de offline: solo lectura. Las queries cacheadas siguen disponibles
 * sin internet; las mutaciones requieren conexión activa (los triggers SQL
 * de venta/abono/folio dependen del server). Mutaciones offline NO en este
 * sprint — ver plan en C:\Users\r\.claude\plans\.
 */

import { get, set, del } from 'idb-keyval';
import type { Persister } from '@tanstack/react-query-persist-client';

const KEY = 'alien:rq-cache';

export const idbPersister: Persister = {
  persistClient: async (client) => {
    await set(KEY, client);
  },
  restoreClient: async () => {
    return (await get(KEY)) ?? undefined;
  },
  removeClient: async () => {
    await del(KEY);
  },
};

/**
 * Lista de prefijos de queryKey que NO deben persistirse:
 * - auth/user/profile: tokens y datos sensibles que vienen del server.
 * - cash-session: la sesión abierta debe ser fresca siempre.
 */
const EXCLUDED_KEY_PREFIXES = new Set(['user', 'auth', 'profile', 'cash-session']);

export function shouldPersistQueryKey(key: readonly unknown[]): boolean {
  const head = String(key[0] ?? '');
  return !EXCLUDED_KEY_PREFIXES.has(head);
}
