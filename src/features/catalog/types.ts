export interface CatalogProduct {
  id: number;
  vendor: string;
  title: string;
  category: string;
  models: string[];
  sku: string;
  price: number | null;
}

export interface CatalogFilter {
  search: string;
  category: string | 'all';
  vendor: string | 'all';
}

export interface CatalogStats {
  total: number;
  withCategory: number;
  withoutCategory: number;
  categories: Array<{ name: string; count: number }>;
  vendors: Array<{ name: string; count: number }>;
}

export interface CatalogRefreshResult {
  ok: boolean;
  count: number;
  durationMs: number;
}

export interface CatalogRefreshProgress {
  page: number;
  found: number;
}

export const DEFAULT_MARKUP_MULTIPLIER = 2.5;

export function suggestedPrice(price: number | null, multiplier: number): number | null {
  if (price == null) return null;
  return Math.round(price * multiplier * 100) / 100;
}

export function multiplierToMarkupPct(multiplier: number): number {
  return Math.round((multiplier - 1) * 100);
}

export function markupPctToMultiplier(pct: number): number {
  return Math.round((1 + pct / 100) * 100) / 100;
}
