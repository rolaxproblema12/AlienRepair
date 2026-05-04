/**
 * Helpers para limpiar y sembrar datos de la sucursal de test entre specs.
 * Usa conexión postgres directa (service role no alcanza para borrar tablas
 * con RLS habilitado de forma generalizada).
 */
import postgres from 'postgres';
import { env } from './env';

export interface DbHandle {
  sql: postgres.Sql;
  end: () => Promise<void>;
}

export function openDb(): DbHandle {
  const sql = postgres(env.supabaseDbUrl, { onnotice: () => {} });
  return { sql, end: () => sql.end() };
}

/**
 * Limpia todos los datos transaccionales de la sucursal de test.
 * Mantiene profiles, products, parts, customers (que se siembran aparte).
 */
export async function resetTransactional(sql: postgres.Sql, sucursalId: string) {
  // Orden importa: hijos primero por FKs.
  await sql`delete from public.sale_items where sucursal_id = ${sucursalId}`;
  await sql`delete from public.order_payments where sucursal_id = ${sucursalId}`;
  await sql`delete from public.sales where sucursal_id = ${sucursalId}`;
  await sql`delete from public.product_movements where sucursal_id = ${sucursalId}`;
  await sql`delete from public.part_movements where sucursal_id = ${sucursalId}`;
  await sql`delete from public.cash_sessions where sucursal_id = ${sucursalId}`;
  await sql`delete from public.orders where sucursal_id = ${sucursalId}`;
  // Resetear contadores de folio para que cada spec empiece en CM-0001.
  await sql`update public.sucursal_counters set current = 0 where sucursal_id = ${sucursalId}`;
}

/**
 * Inserta un producto demo con stock para los tests de venta.
 */
export async function seedProduct(
  sql: postgres.Sql,
  sucursalId: string,
  args: { name: string; price: number; stock: number; sku?: string },
): Promise<{ id: string }> {
  const [product] = await sql<{ id: string }[]>`
    insert into public.products (sucursal_id, name, sku, sale_price, cost_price, iva_rate, stock)
    values (${sucursalId}, ${args.name}, ${args.sku ?? null}, ${args.price}, ${args.price * 0.5}, 0.16, ${args.stock})
    returning id
  `;
  return product;
}

/**
 * Inserta una orden de reparación con saldo pendiente.
 */
export async function seedOrder(
  sql: postgres.Sql,
  sucursalId: string,
  args: { customerName: string; cost: number; downPayment?: number },
): Promise<{ id: string; folio: string }> {
  const [customer] = await sql<{ id: string }[]>`
    insert into public.customers (sucursal_id, name)
    values (${sucursalId}, ${args.customerName})
    returning id
  `;
  const [order] = await sql<{ id: string; folio: string }[]>`
    insert into public.orders (sucursal_id, customer_id, kind, brand, model, item_description, cost, down_payment, status)
    values (${sucursalId}, ${customer.id}, 'reparacion', 'Apple', 'iPhone 14', 'No prende', ${args.cost}, ${args.downPayment ?? 0}, 'recibido')
    returning id, folio
  `;
  return order;
}
