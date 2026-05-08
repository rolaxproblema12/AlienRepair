import type { QueryClient } from '@tanstack/react-query';

/**
 * Helpers centralizados de invalidación de React Query.
 *
 * Antes cada mutation invalidaba a mano 5-10 queryKeys, y era fácil
 * olvidarse de uno (ej: `orders-with-balance` faltaba en varios sitios
 * y el picker de cobro de OS quedaba stale). Acá centralizamos qué
 * keys tocar por dominio.
 *
 * REGLAS:
 * - Estos helpers son PUROS (string keys + QueryClient). No importar tipos
 *   de features para evitar ciclos de dependencia.
 * - Cada helper documenta en JSDoc qué keys toca y por qué — sirve de
 *   inventario vivo del proyecto. Si agregás un queryKey nuevo, sumalo
 *   acá.
 * - Si un caso cruza varios dominios (ej: una venta que afecta stock),
 *   componer dos helpers en lugar de inventar uno custom — salvo el
 *   helper compuesto `invalidateSaleWithStock` que se repite tanto que
 *   tiene su propia función.
 */

// =====================================================
// Orders
// =====================================================

interface OrderInvalidateOpts {
  orderId?: string;
  customerId?: string | null;
  /** Si el cambio de status afecta accounting (ej: pasó a/desde 'entregado'). */
  accountingAffected?: boolean;
}

/**
 * Invalida queries relacionadas a una orden de servicio.
 *
 * Toca SIEMPRE: orders, orders-agenda, orders-overdue, orders-overdue-count,
 * orders-with-balance.
 * Con `orderId`: order, order-balance, order-payments, order-parts.
 * Con `customerId`: customer-orders, customer-active-orders.
 * Con `accountingAffected`: accounting/daily, dashboard-revenue-7d.
 */
export function invalidateOrderRelated(
  qc: QueryClient,
  sucursalId: string,
  opts: OrderInvalidateOpts = {},
): void {
  qc.invalidateQueries({ queryKey: ['orders', sucursalId] });
  qc.invalidateQueries({ queryKey: ['orders-agenda', sucursalId] });
  qc.invalidateQueries({ queryKey: ['orders-overdue', sucursalId] });
  qc.invalidateQueries({ queryKey: ['orders-overdue-count', sucursalId] });
  qc.invalidateQueries({ queryKey: ['orders-with-balance', sucursalId] });
  qc.invalidateQueries({ queryKey: ['warranty-orders', sucursalId] });

  if (opts.orderId) {
    qc.invalidateQueries({ queryKey: ['order', sucursalId, opts.orderId] });
    qc.invalidateQueries({ queryKey: ['order-balance', sucursalId, opts.orderId] });
    qc.invalidateQueries({ queryKey: ['order-payments', sucursalId, opts.orderId] });
    qc.invalidateQueries({ queryKey: ['order-parts', sucursalId, opts.orderId] });
  }

  if (opts.customerId) {
    qc.invalidateQueries({
      queryKey: ['customer-orders', sucursalId, opts.customerId],
    });
    qc.invalidateQueries({
      queryKey: ['customer-active-orders', sucursalId, opts.customerId],
    });
    qc.invalidateQueries({
      queryKey: ['customer-warranty-orders', sucursalId, opts.customerId],
    });
  } else {
    // Sin customerId conocido: invalidar warranty-orders a nivel sucursal
    // para que el dialog "Nueva garantía" no muestre lista stale después
    // de que una OS pase a entregado/reabra.
    qc.invalidateQueries({
      queryKey: ['customer-warranty-orders', sucursalId],
    });
  }

  if (opts.accountingAffected) {
    qc.invalidateQueries({ queryKey: ['accounting', 'daily', sucursalId] });
    qc.invalidateQueries({ queryKey: ['dashboard-revenue-7d', sucursalId] });
  }
}

/**
 * Variante para cuando se eliminan queries (delete order).
 * Hace todo lo de invalidateOrderRelated y además remueve `order` cache.
 */
export function removeOrderRelated(
  qc: QueryClient,
  sucursalId: string,
  orderId: string,
): void {
  invalidateOrderRelated(qc, sucursalId);
  qc.removeQueries({ queryKey: ['order', sucursalId, orderId] });
}

// =====================================================
// Sales
// =====================================================

interface SaleInvalidateOpts {
  saleId?: string;
  /**
   * IDs de órdenes afectadas. Una venta puede tener líneas tipo
   * `abono_orden` que tocan multiples OS. Si se omite cuando hay
   * abonos, los balances quedan stale.
   */
  orderIds?: Array<string | null | undefined>;
}

/**
 * Invalida queries relacionadas a ventas de caja.
 *
 * Toca SIEMPRE: sales, sales-infinite, day-balance, accounting/daily,
 * orders-with-balance.
 * Con `saleId`: sale, sale-payments, sale-returns.
 * Con `orderIds`: order-balance y order-payments para cada uno.
 *
 * Nota: ['sales'] y ['sales-infinite'] son caches separados con la misma
 * data — invalidar SIEMPRE los dos.
 */
export function invalidateSaleRelated(
  qc: QueryClient,
  sucursalId: string,
  opts: SaleInvalidateOpts = {},
): void {
  qc.invalidateQueries({ queryKey: ['sales', sucursalId] });
  qc.invalidateQueries({ queryKey: ['sales-infinite', sucursalId] });
  qc.invalidateQueries({ queryKey: ['day-balance', sucursalId] });
  qc.invalidateQueries({ queryKey: ['accounting', 'daily', sucursalId] });
  qc.invalidateQueries({ queryKey: ['orders-with-balance', sucursalId] });

  if (opts.saleId) {
    qc.invalidateQueries({ queryKey: ['sale', sucursalId, opts.saleId] });
    qc.invalidateQueries({ queryKey: ['sale-payments', sucursalId, opts.saleId] });
    qc.invalidateQueries({ queryKey: ['sale-returns', sucursalId, opts.saleId] });
  }

  const orderIds = (opts.orderIds ?? []).filter(
    (x): x is string => !!x,
  );
  if (orderIds.length === 0) return;
  // Si hay órdenes específicas, invalidar las suyas. Si la venta cubría
  // muchas, también invalidamos a nivel sucursal para no quedarnos cortos.
  for (const id of orderIds) {
    qc.invalidateQueries({ queryKey: ['order-balance', sucursalId, id] });
    qc.invalidateQueries({ queryKey: ['order-payments', sucursalId, id] });
  }
}

/**
 * Helper compuesto: venta + producto + utility report.
 * Usado por useCreateSale y useCancelSale (mismas invalidaciones).
 */
export function invalidateSaleWithStock(
  qc: QueryClient,
  sucursalId: string,
  opts: SaleInvalidateOpts = {},
): void {
  invalidateSaleRelated(qc, sucursalId, opts);
  invalidateProductRelated(qc, sucursalId);
}

// =====================================================
// Products (inventory)
// =====================================================

interface ProductInvalidateOpts {
  productId?: string;
}

/**
 * Toca SIEMPRE: products, inventory-utility.
 * Con `productId`: product, product-movements.
 */
export function invalidateProductRelated(
  qc: QueryClient,
  sucursalId: string,
  opts: ProductInvalidateOpts = {},
): void {
  qc.invalidateQueries({ queryKey: ['products', sucursalId] });
  qc.invalidateQueries({ queryKey: ['inventory-utility', sucursalId] });

  if (opts.productId) {
    qc.invalidateQueries({ queryKey: ['product', sucursalId, opts.productId] });
    qc.invalidateQueries({
      queryKey: ['product-movements', sucursalId, opts.productId],
    });
  }
}

// =====================================================
// Parts (refacciones)
// =====================================================

interface PartInvalidateOpts {
  partId?: string;
  /** Si la pieza fue usada/reversada en una OS, también invalidar su balance. */
  orderId?: string;
}

/**
 * Toca SIEMPRE: parts, parts-brands.
 * Con `partId`: part, part-movements.
 * Con `orderId`: order-parts, order-balance.
 */
export function invalidatePartRelated(
  qc: QueryClient,
  sucursalId: string,
  opts: PartInvalidateOpts = {},
): void {
  qc.invalidateQueries({ queryKey: ['parts', sucursalId] });
  qc.invalidateQueries({ queryKey: ['parts-brands', sucursalId] });

  if (opts.partId) {
    qc.invalidateQueries({ queryKey: ['part', sucursalId, opts.partId] });
    qc.invalidateQueries({
      queryKey: ['part-movements', sucursalId, opts.partId],
    });
  }

  if (opts.orderId) {
    qc.invalidateQueries({ queryKey: ['order-parts', sucursalId, opts.orderId] });
    qc.invalidateQueries({ queryKey: ['order-balance', sucursalId, opts.orderId] });
  }
}

// =====================================================
// Customers
// =====================================================

interface CustomerInvalidateOpts {
  customerId?: string;
}

/**
 * Toca SIEMPRE: customers.
 * Con `customerId`: customer, customer-orders, customer-active-orders,
 * customer-warranty-orders.
 */
export function invalidateCustomerRelated(
  qc: QueryClient,
  sucursalId: string,
  opts: CustomerInvalidateOpts = {},
): void {
  qc.invalidateQueries({ queryKey: ['customers', sucursalId] });

  if (opts.customerId) {
    qc.invalidateQueries({ queryKey: ['customer', sucursalId, opts.customerId] });
    qc.invalidateQueries({
      queryKey: ['customer-orders', sucursalId, opts.customerId],
    });
    qc.invalidateQueries({
      queryKey: ['customer-active-orders', sucursalId, opts.customerId],
    });
    qc.invalidateQueries({
      queryKey: ['customer-warranty-orders', sucursalId, opts.customerId],
    });
  } else {
    // Sin customerId: invalidar todas las queries derivadas a nivel sucursal.
    qc.invalidateQueries({ queryKey: ['customer', sucursalId] });
    qc.invalidateQueries({ queryKey: ['customer-orders', sucursalId] });
    qc.invalidateQueries({ queryKey: ['customer-active-orders', sucursalId] });
    qc.invalidateQueries({ queryKey: ['customer-warranty-orders', sucursalId] });
  }
}

// =====================================================
// Accounting
// =====================================================

/**
 * Toca: expenses, expenses-infinite, accounting/daily, dashboard-revenue-7d.
 */
export function invalidateAccountingRelated(
  qc: QueryClient,
  sucursalId: string,
): void {
  qc.invalidateQueries({ queryKey: ['expenses', sucursalId] });
  qc.invalidateQueries({ queryKey: ['expenses-infinite', sucursalId] });
  qc.invalidateQueries({ queryKey: ['accounting', 'daily', sucursalId] });
  qc.invalidateQueries({ queryKey: ['dashboard-revenue-7d', sucursalId] });
}

// =====================================================
// Cash session
// =====================================================

/**
 * Toca: cash-session, day-balance.
 */
export function invalidateCashSessionRelated(
  qc: QueryClient,
  sucursalId: string,
): void {
  qc.invalidateQueries({ queryKey: ['cash-session', sucursalId] });
  qc.invalidateQueries({ queryKey: ['day-balance', sucursalId] });
}
