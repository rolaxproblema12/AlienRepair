/**
 * Migration runner para AlienRepair.
 *
 * Modos:
 *   npm run db:migrate                          → aplica las pendientes
 *   npm run db:status                           → solo lista pendientes vs aplicadas
 *   npm run db:mark-applied -- <files...>       → marca archivos como aplicados sin ejecutar
 *
 * Requiere SUPABASE_DB_URL en env (Postgres connection string directa, no anon key):
 *   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
 *
 * Las migraciones viven en supabase/migrations/<NNNN>_<name>.sql y se aplican
 * en orden lexicográfico. Cada archivo se ejecuta dentro de una transacción.
 * NO incluyas BEGIN;/COMMIT; explícitos en el cuerpo — el runner los envuelve.
 */

import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations');

interface AppliedRow {
  id: string;
  hash: string;
  applied_at: Date;
}

async function loadMigrations() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const out: { id: string; content: string; hash: string }[] = [];
  for (const file of files) {
    const content = await readFile(resolve(MIGRATIONS_DIR, file), 'utf-8');
    out.push({
      id: file,
      content,
      hash: createHash('sha256').update(content).digest('hex'),
    });
  }
  return out;
}

async function ensureUrl(): Promise<string> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('Falta SUPABASE_DB_URL. Configurala en .env.local o como variable de entorno.');
    console.error('Formato: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres');
    process.exit(1);
  }
  return url;
}

async function fetchApplied(sql: postgres.Sql): Promise<Map<string, string>> {
  const rows = await sql<AppliedRow[]>`select id, hash, applied_at from app._migrations`;
  return new Map(rows.map((r) => [r.id, r.hash]));
}

async function statusCommand() {
  const url = await ensureUrl();
  const sql = postgres(url, { onnotice: () => {} });
  try {
    const applied = await fetchApplied(sql);
    const migrations = await loadMigrations();
    let pending = 0;
    let mismatch = 0;
    for (const m of migrations) {
      const prev = applied.get(m.id);
      if (!prev) {
        console.log(`+ pending     ${m.id}`);
        pending += 1;
      } else if (prev !== m.hash) {
        console.log(`! hash-drift  ${m.id}  (aplicada con hash distinto al disco)`);
        mismatch += 1;
      } else {
        console.log(`= applied     ${m.id}`);
      }
    }
    const orphaned = [...applied.keys()].filter((id) => !migrations.find((m) => m.id === id));
    for (const id of orphaned) console.log(`? orphaned    ${id}  (en DB pero no en disco)`);
    console.log(`\n${migrations.length} migraciones | ${pending} pending | ${mismatch} hash-drift | ${orphaned.length} orphaned`);
  } finally {
    await sql.end();
  }
}

async function migrateCommand() {
  const url = await ensureUrl();
  const sql = postgres(url, { onnotice: () => {} });
  try {
    const applied = await fetchApplied(sql);
    const migrations = await loadMigrations();

    let appliedCount = 0;
    for (const m of migrations) {
      const prev = applied.get(m.id);
      if (prev === m.hash) continue;
      if (prev && prev !== m.hash) {
        console.error(`! ${m.id} fue aplicada con hash distinto. No se modifica una migración aplicada.`);
        console.error(`  Crea una nueva migración con los cambios necesarios.`);
        process.exit(1);
      }
      console.log(`+ aplicando ${m.id}…`);
      await sql.begin(async (tx) => {
        await tx.unsafe(m.content);
        await tx`insert into app._migrations (id, hash) values (${m.id}, ${m.hash})`;
      });
      appliedCount += 1;
    }
    if (appliedCount === 0) console.log('No hay migraciones pendientes.');
    else console.log(`Aplicadas ${appliedCount} migraciones.`);
  } finally {
    await sql.end();
  }
}

async function markAppliedCommand(files: string[]) {
  if (files.length === 0) {
    console.error('Pasa al menos un archivo: npm run db:mark-applied -- 0001_init.sql ...');
    process.exit(1);
  }
  const url = await ensureUrl();
  const sql = postgres(url, { onnotice: () => {} });
  try {
    const migrations = await loadMigrations();
    const byId = new Map(migrations.map((m) => [m.id, m]));
    for (const file of files) {
      const m = byId.get(file);
      if (!m) {
        console.error(`! ${file} no existe en supabase/migrations/`);
        process.exit(1);
      }
      await sql`
        insert into app._migrations (id, hash) values (${m.id}, ${m.hash})
        on conflict (id) do update set hash = excluded.hash
      `;
      console.log(`= marcada como aplicada: ${m.id}`);
    }
  } finally {
    await sql.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--status') return statusCommand();
  if (args[0] === '--mark-applied') return markAppliedCommand(args.slice(1));
  return migrateCommand();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
