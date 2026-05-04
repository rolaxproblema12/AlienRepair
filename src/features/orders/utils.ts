import type { OrderKind } from './types';

export function routeFor(kind: OrderKind | undefined, id: string): string {
  if (kind === 'encargo') return `/encargos/${id}`;
  if (kind === 'accesorio') return `/accesorios/${id}`;
  return `/reparaciones/${id}`;
}
