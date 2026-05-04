// Consolidates fixoem.com product pages into a single normalized catalog.
// Reads data/scratch/fixoem_p*.json (Shopify products.json output)
// Writes:
//   - data/fixoem-catalog.json
//   - data/fixoem-catalog.csv
//   - data/fixoem-categories.json (tally)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SCRATCH = 'data/scratch';
const OUT_DIR = 'data';

const files = readdirSync(SCRATCH)
  .filter((f) => f.startsWith('fixoem_p') && f.endsWith('.json'))
  .sort((a, b) => {
    const na = Number(a.match(/p(\d+)/)[1]);
    const nb = Number(b.match(/p(\d+)/)[1]);
    return na - nb;
  });

const seen = new Set();
const products = [];

for (const f of files) {
  const raw = readFileSync(join(SCRATCH, f), 'utf8').trim();
  if (!raw || raw === '{"products":[]}') continue;
  let data;
  try { data = JSON.parse(raw); } catch { continue; }
  if (!data?.products?.length) continue;
  for (const p of data.products) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);

    const body = (p.body_html || '').replace(/<[^>]+>/g, '').replace(/\r/g, '');
    const catMatch = body.match(/Categor[íi]a\s*:\s*([^\n]+)/i);
    const category = catMatch ? catMatch[1].trim() : '';

    // "Modelos Compatibles:\n  1. ..." — pull up to first blank line
    let models = [];
    const modSection = body.match(/Modelos\s+Compatibles\s*:\s*([\s\S]*?)(?:\n\s*\n|Detalles:|$)/i);
    if (modSection) {
      models = modSection[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
        .filter(Boolean);
    }

    const v = p.variants?.[0];

    products.push({
      id: p.id,
      vendor: p.vendor || '',
      title: p.title,
      category,
      models,
      sku: v?.sku || '',
      price: v ? Number(v.price) : null,
    });
  }
}

// Tally categories (raw text)
const tally = {};
for (const p of products) {
  const k = p.category || '(sin categoría)';
  tally[k] = (tally[k] || 0) + 1;
}
const tallySorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);

writeFileSync(
  join(OUT_DIR, 'fixoem-catalog.json'),
  JSON.stringify(products, null, 2),
  'utf8',
);

// CSV
const csvHead = ['id', 'vendor', 'title', 'category', 'models', 'sku', 'price'];
const esc = (v) => {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join(' | ') : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const csvLines = [csvHead.join(',')];
for (const p of products) {
  csvLines.push(csvHead.map((k) => esc(p[k])).join(','));
}
writeFileSync(join(OUT_DIR, 'fixoem-catalog.csv'), csvLines.join('\n'), 'utf8');

writeFileSync(
  join(OUT_DIR, 'fixoem-categories.json'),
  JSON.stringify(Object.fromEntries(tallySorted), null, 2),
  'utf8',
);

console.log(`✓ ${products.length} productos únicos`);
console.log(`✓ ${Object.keys(tally).length} categorías distintas`);
console.log(`Top 15 categorías:`);
for (const [k, v] of tallySorted.slice(0, 15)) {
  console.log(`  ${v.toString().padStart(5)}  ${k}`);
}
console.log('\nArchivos generados:');
console.log('  data/fixoem-catalog.json');
console.log('  data/fixoem-catalog.csv');
console.log('  data/fixoem-categories.json');
