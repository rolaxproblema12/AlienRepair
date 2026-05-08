/**
 * Lista tablas y vistas del schema `public` con conteo de filas.
 *
 *   npm run db:tables
 *
 * Lee SUPABASE_DB_URL del .env.local (mismo patrón que migrate.ts).
 * Read-only: no toca nada, solo SELECT.
 */

import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

interface Row {
  kind: 'table' | 'view';
  name: string;
  filas: string | null;
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('Falta SUPABASE_DB_URL en .env.local');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    // Tablas con n_live_tup (estimado de pg_stat). Más rápido que count(*)
    // exacto y suficiente para ver el panorama.
    const rows = await sql<Row[]>`
      select
        case when t.table_type = 'BASE TABLE' then 'table' else 'view' end as kind,
        t.table_name as name,
        s.n_live_tup::text as filas
      from information_schema.tables t
      left join pg_stat_user_tables s
        on s.schemaname = t.table_schema and s.relname = t.table_name
      where t.table_schema = 'public'
      order by kind, t.table_name
    `;

    if (rows.length === 0) {
      console.log('Schema public está vacío.');
      return;
    }

    const tables = rows.filter((r) => r.kind === 'table');
    const views = rows.filter((r) => r.kind === 'view');

    if (tables.length) {
      console.log(`\nTablas (${tables.length}):`);
      const widthName = Math.max(...tables.map((r) => r.name.length));
      for (const r of tables) {
        const filas = r.filas ?? '?';
        console.log(`  ${r.name.padEnd(widthName)}  ${filas.padStart(8)} filas`);
      }
    }

    if (views.length) {
      console.log(`\nVistas (${views.length}):`);
      for (const r of views) console.log(`  ${r.name}`);
    }
    console.log();
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
