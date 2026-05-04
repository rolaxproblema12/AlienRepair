import type { CatalogProduct } from '@/features/catalog/types';
import {
  SYMPTOM_TO_CATEGORIES,
  detectSymptom,
  type Symptom,
} from '@/features/catalog/categoryMap';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export function categoryMatches(productCategory: string, symptom: Symptom): boolean {
  const candidates = SYMPTOM_TO_CATEGORIES[symptom];
  const cat = norm(productCategory);
  return candidates.some((c) => cat.includes(norm(c)));
}

export function modelMatches(productModels: string[], brand: string, model: string): boolean {
  if (!model && !brand) return false;
  const needles = [
    norm(`${brand} ${model}`.trim()),
    norm(model),
    norm(brand),
  ].filter((s) => s.length >= 2);
  return productModels.some((m) => {
    const candidate = norm(m);
    return needles.some((n) => candidate.includes(n) || n.includes(candidate));
  });
}

export function matchSuggestions(
  catalog: CatalogProduct[],
  brand: string | null | undefined,
  model: string | null | undefined,
  problem: string | null | undefined,
  limit = 5,
): CatalogProduct[] {
  const cleanBrand = (brand ?? '').trim();
  const cleanModel = (model ?? '').trim();
  const symptom = detectSymptom(problem);

  if (!cleanModel && !cleanBrand) return [];
  if (!symptom) return [];

  const scored: Array<{ p: CatalogProduct; score: number }> = [];
  for (const p of catalog) {
    if (!p.category) continue;
    if (!categoryMatches(p.category, symptom)) continue;
    const hit = modelMatches(p.models, cleanBrand, cleanModel);
    if (!hit) continue;
    const score = (p.price ?? 9_999_999);
    scored.push({ p, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((x) => x.p);
}

export function filterCatalog(
  catalog: CatalogProduct[],
  filter: { search: string; category: string | 'all'; vendor: string | 'all' },
): CatalogProduct[] {
  const q = norm(filter.search);
  const tokens = q.split(/\s+/).filter(Boolean);
  return catalog.filter((p) => {
    if (filter.category !== 'all' && p.category !== filter.category) return false;
    if (filter.vendor !== 'all' && p.vendor !== filter.vendor) return false;
    if (tokens.length === 0) return true;
    const hay = norm(
      `${p.title} ${p.sku} ${p.category} ${p.vendor} ${p.models.join(' ')}`,
    );
    return tokens.every((t) => hay.includes(t));
  });
}
