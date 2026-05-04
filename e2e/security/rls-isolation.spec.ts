import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { env } from '../fixtures/env';

/**
 * Verifica que las RLS policies aíslan datos entre sucursales:
 * - Un user asignado a sucursal A no puede SELECT órdenes de sucursal B.
 * - Tampoco puede INSERT en sucursal B.
 * - Sí puede SELECT sus propias órdenes (sanity check, evita falsos OK
 *   donde TODO devuelve 0 rows por una policy demasiado restrictiva).
 *
 * No usa Electron — testea directo contra PostgREST con el JWT del user
 * E2E. El setup crea una segunda sucursal "OTH" via DB directa
 * (bypass RLS), y la limpia en afterAll.
 *
 * Asume que el user E2E (env.userEmail) está active=true y asignado
 * vía user_sucursales a env.sucursalId, NUNCA a la sucursal OTH.
 */

test.describe('RLS — aislamiento entre sucursales', () => {
  let sql: postgres.Sql;
  let otherSucursalId: string;
  let userClient: SupabaseClient;

  test.beforeAll(async () => {
    sql = postgres(env.supabaseDbUrl, { onnotice: () => {} });

    // Crear (o reusar) la segunda sucursal de test.
    const [other] = await sql<{ id: string }[]>`
      insert into public.sucursales (code, name, address)
      values ('OTH', 'Otra Sucursal RLS Test', 'N/A')
      on conflict (code) do update set name = excluded.name
      returning id
    `;
    otherSucursalId = other.id;

    // Login del user E2E. Reusamos el mismo cliente para todos los tests
    // — el JWT es lo que dispara las policies.
    userClient = createClient(env.supabaseUrl, env.supabaseAnonKey);
    const { error } = await userClient.auth.signInWithPassword({
      email: env.userEmail,
      password: env.userPassword,
    });
    if (error) throw new Error(`E2E login falló: ${error.message}`);
  });

  test.afterAll(async () => {
    // Cascade no toca sucursal_counters (cascade explícito) pero sí orders
    // por la FK con on delete cascade implícito? Por las dudas, limpiamos
    // hijos primero.
    await sql`delete from public.orders where sucursal_id = ${otherSucursalId}`;
    await sql`delete from public.customers where sucursal_id = ${otherSucursalId}`;
    await sql`delete from public.sucursal_counters where sucursal_id = ${otherSucursalId}`;
    await sql`delete from public.sucursales where id = ${otherSucursalId}`;
    await userClient.auth.signOut().catch(() => {});
    await sql.end();
  });

  test.beforeEach(async () => {
    // Limpieza entre tests: no acumular órdenes del run anterior en OTH.
    await sql`delete from public.orders where sucursal_id = ${otherSucursalId}`;
    await sql`delete from public.customers where sucursal_id = ${otherSucursalId}`;
  });

  test('SELECT en sucursal ajena devuelve 0 rows', async () => {
    // Seed: una orden EN sucursal OTH (vía DB directa, RLS bypass).
    const [customer] = await sql<{ id: string }[]>`
      insert into public.customers (sucursal_id, name)
      values (${otherSucursalId}, 'Cliente Otra Sucursal')
      returning id
    `;
    const [orderRow] = await sql<{ id: string }[]>`
      insert into public.orders (
        sucursal_id, customer_id, kind, brand, model,
        item_description, cost, status
      )
      values (
        ${otherSucursalId}, ${customer.id}, 'reparacion',
        'Apple', 'iPhone X', 'No prende', 500, 'recibido'
      )
      returning id
    `;

    // Sanity: la fila existe en DB (vía conexión directa).
    const [check] = await sql<{ count: string }[]>`
      select count(*)::text as count from public.orders where id = ${orderRow.id}
    `;
    expect(Number(check.count)).toBe(1);

    // Pero el user E2E (no asignado a OTH) la ve como inexistente.
    const { data, error } = await userClient
      .from('orders')
      .select('id')
      .eq('id', orderRow.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Y un filtro por sucursal_id directo tampoco la trae.
    const { data: all, error: errAll } = await userClient
      .from('orders')
      .select('id')
      .eq('sucursal_id', otherSucursalId);
    expect(errAll).toBeNull();
    expect(all ?? []).toHaveLength(0);
  });

  test('INSERT en sucursal ajena es rechazado por RLS', async () => {
    // Seed: cliente en OTH para tener una FK válida.
    const [customer] = await sql<{ id: string }[]>`
      insert into public.customers (sucursal_id, name)
      values (${otherSucursalId}, 'Cliente RLS Insert')
      returning id
    `;

    const { data, error } = await userClient
      .from('orders')
      .insert({
        sucursal_id: otherSucursalId,
        customer_id: customer.id,
        kind: 'reparacion',
        brand: 'Test',
        model: 'Test',
        item_description: 'no debería pasar',
        cost: 100,
        status: 'recibido',
      })
      .select();

    // Cualquier resultado positivo (data array no vacío y sin error) es regresión.
    expect(error, 'PostgREST debe rechazar el insert por RLS').not.toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Verificación complementaria: no quedó nada nuevo en orders de OTH.
    const [check] = await sql<{ count: string }[]>`
      select count(*)::text as count from public.orders
      where sucursal_id = ${otherSucursalId}
    `;
    expect(Number(check.count)).toBe(0);
  });

  test('SELECT en sucursal asignada SÍ funciona (sanity)', async () => {
    // Si esto falla, todo el test suite es opaco — significa que el user
    // tampoco lee su propia data, así que las assertions de "0 rows" arriba
    // serían falsamente positivas.
    const [customer] = await sql<{ id: string }[]>`
      insert into public.customers (sucursal_id, name)
      values (${env.sucursalId}, 'Cliente Sanity RLS')
      returning id
    `;
    const [orderRow] = await sql<{ id: string }[]>`
      insert into public.orders (
        sucursal_id, customer_id, kind, brand, model,
        item_description, cost, status
      )
      values (
        ${env.sucursalId}, ${customer.id}, 'reparacion',
        'Sanity', 'Check', 'verifica que el user sí lee su propia sucursal',
        50, 'recibido'
      )
      returning id
    `;

    try {
      const { data, error } = await userClient
        .from('orders')
        .select('id')
        .eq('id', orderRow.id);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(1);
    } finally {
      await sql`delete from public.orders where id = ${orderRow.id}`;
      await sql`delete from public.customers where id = ${customer.id}`;
    }
  });
});
