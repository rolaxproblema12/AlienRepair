import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateSaleWithStock } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type {
  CartLine,
  SaleDetail,
  SaleItem,
  SalePaymentMethod,
  SaleWithCustomer,
} from '../types';
import { calcLineTotal } from '../types';

export const SALE_COLUMNS = `
  id, folio, cash_session_id, customer_id, subtotal, iva_total, discount_total,
  total, payment_method, notes, status, cancelled_at, cancelled_by, cancel_reason,
  created_at, created_by,
  customer:customers(id, name, phone)
`;

// Idem para sale_items: el tipo SaleItem no incluye sucursal_id ni created_at.
export const SALE_ITEM_COLUMNS =
  'id, sale_id, kind, product_id, order_id, description, quantity, unit_price, unit_cost, iva_rate, discount, line_total';

interface SalesFilter {
  search?: string;
  from?: string;
  to?: string;
  paymentMethod?: SalePaymentMethod | 'all';
  status?: 'all' | 'completada' | 'cancelada';
}

// Page size para SalesHistoryPage. 20 es el "collapse threshold" que tenía
// la UI antes de paginar de verdad — mantener ese valor minimiza el cambio
// percibido para el usuario.
//
// IMPORTANTE: cualquier mutation que invalide ['sales', sucursalId] DEBE
// invalidar también ['sales-infinite', sucursalId]. Son dos cachés separados
// que sirven la misma data en formatos distintos. Si te olvidás de uno,
// la UI muestra datos stale hasta el próximo refresh manual.
const SALES_PAGE_SIZE = 20;

/**
 * Versión paginada de useSales para tablas grandes (SalesHistoryPage).
 * Devuelve InfiniteData que la UI flatMapea a un array plano + boolean
 * hasNextPage para mostrar el botón "Cargar más".
 *
 * Mantenemos useSales (no paginado, capeo 500) para CommandPalette y
 * CashRegisterPage que solo muestran la primera página.
 */
export function useInfiniteSales(filter: SalesFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useInfiniteQuery({
    queryKey: ['sales-infinite', sucursalId, filter],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const fromIdx = pageParam * SALES_PAGE_SIZE;
      const toIdx = fromIdx + SALES_PAGE_SIZE - 1;
      let q = supabase
        .from('sales')
        .select(SALE_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .range(fromIdx, toIdx);

      if (filter.from) q = q.gte('created_at', `${filter.from}T00:00:00`);
      if (filter.to) q = q.lte('created_at', `${filter.to}T23:59:59`);
      if (filter.paymentMethod && filter.paymentMethod !== 'all') {
        q = q.eq('payment_method', filter.paymentMethod);
      }
      if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);
      if (filter.search?.trim()) {
        q = q.ilike('folio', `%${filter.search.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as SaleWithCustomer[];
      return {
        rows,
        nextPage: rows.length === SALES_PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
}

export function useSales(filter: SalesFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['sales', sucursalId, filter],
    queryFn: async () => {
      let q = supabase
        .from('sales')
        .select(SALE_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (filter.from) q = q.gte('created_at', `${filter.from}T00:00:00`);
      if (filter.to) q = q.lte('created_at', `${filter.to}T23:59:59`);
      if (filter.paymentMethod && filter.paymentMethod !== 'all') {
        q = q.eq('payment_method', filter.paymentMethod);
      }
      if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);
      if (filter.search?.trim()) {
        const term = filter.search.trim();
        // folio ahora es text con prefijo (ej "CM-0042"). Usamos ilike para
        // matching parcial: el usuario puede buscar "42", "0042" o "CM-0042".
        q = q.ilike('folio', `%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SaleWithCustomer[];
    },
  });
}

export function useSale(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['sale', sucursalId, id],
    queryFn: async () => {
      const [
        { data: sale, error: e1 },
        { data: items, error: e2 },
        { data: payments, error: e3 },
      ] = await Promise.all([
        supabase.from('sales').select(SALE_COLUMNS).eq('id', id!).single(),
        supabase
          .from('sale_items')
          .select(SALE_ITEM_COLUMNS)
          .eq('sale_id', id!)
          .order('id'),
        supabase
          .from('sale_payments')
          .select('id, sale_id, sucursal_id, payment_method, amount, notes, created_at')
          .eq('sale_id', id!)
          .order('created_at', { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      return {
        ...(sale as unknown as SaleWithCustomer),
        items: (items ?? []) as SaleItem[],
        payments: (payments ?? []) as import('../types').SalePayment[],
      } as SaleDetail;
    },
    enabled: !!id,
    staleTime: STALE_TIMES.FAST,
  });
}

export interface PaymentSplit {
  payment_method: SalePaymentMethod;
  amount: number;
}

interface CreateSaleInput {
  cashSessionId: string;
  customerId: string | null;
  /** Lista de pagos. Si tiene 1 elemento es venta con un solo método;
   *  con 2+ es split tender. La suma debe igualar el total de la venta. */
  payments: PaymentSplit[];
  notes: string | null;
  lines: CartLine[];
}

export function useCreateSale() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // calcular totales
      let subtotal = 0;
      let iva_total = 0;
      let discount_total = 0;
      let total = 0;
      for (const l of input.lines) {
        const lineTotal = calcLineTotal(l);
        const ivaPart = lineTotal - lineTotal / (1 + Number(l.iva_rate));
        const sub = lineTotal - ivaPart;
        subtotal += sub;
        iva_total += ivaPart;
        discount_total += Number(l.discount) || 0;
        total += lineTotal;
      }

      // Validar pagos: la suma debe coincidir con el total (tolerancia 1 cent).
      const totalPaid = input.payments.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(totalPaid - total) > 0.02) {
        throw new Error(
          `Suma de pagos (${totalPaid.toFixed(2)}) no coincide con total (${total.toFixed(2)})`,
        );
      }

      // Método "principal" inicial = el de mayor monto. El trigger SQL
      // sync_sale_primary_method lo recalcula al insertar sale_payments,
      // pero lo seteamos acá también para no dejar la venta con valor
      // arbitrario entre el insert y el trigger.
      const primaryPayment = [...input.payments].sort(
        (a, b) => b.amount - a.amount,
      )[0];

      const { data: sale, error } = await supabase
        .from('sales')
        .insert({
          sucursal_id: sucursalId,
          cash_session_id: input.cashSessionId,
          customer_id: input.customerId,
          subtotal: Number(subtotal.toFixed(2)),
          iva_total: Number(iva_total.toFixed(2)),
          discount_total: Number(discount_total.toFixed(2)),
          total: Number(total.toFixed(2)),
          payment_method: primaryPayment.payment_method,
          notes: input.notes,
          created_by: userId,
        })
        .select(SALE_COLUMNS)
        .single();
      if (error) throw error;
      const created = sale as unknown as SaleWithCustomer;

      // insertar items (los triggers DB se encargan del resto)
      const itemRows = input.lines.map((l) => ({
        sale_id: created.id,
        sucursal_id: sucursalId,
        kind: l.kind,
        product_id: l.product_id,
        order_id: l.order_id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit_cost: l.unit_cost,
        iva_rate: l.iva_rate,
        discount: l.discount,
        line_total: calcLineTotal(l),
      }));
      const { error: itemErr } = await supabase.from('sale_items').insert(itemRows);
      if (itemErr) {
        // rollback manual: borrar la venta huérfana (los triggers no se dispararon completamente)
        await supabase.from('sales').delete().eq('id', created.id);
        throw itemErr;
      }

      // insertar pagos (split tender). El trigger sync_sale_primary_method
      // recalcula sales.payment_method si difiere del primary que ya pusimos.
      const paymentRows = input.payments.map((p) => ({
        sale_id: created.id,
        sucursal_id: sucursalId,
        payment_method: p.payment_method,
        amount: Number(p.amount.toFixed(2)),
      }));
      const { error: payErr } = await supabase
        .from('sale_payments')
        .insert(paymentRows);
      if (payErr) {
        await supabase.from('sales').delete().eq('id', created.id);
        throw payErr;
      }

      return created;
    },
    onSuccess: (_data, vars) => {
      // Las líneas tipo abono_orden tocan balances de OS — pasarlas al helper.
      const orderIds = vars.lines
        .filter((l) => l.kind === 'abono_orden' && l.order_id)
        .map((l) => l.order_id);
      invalidateSaleWithStock(qc, sucursalId, { orderIds });
    },
  });
}

export function useCancelSale() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('sales')
        .update({
          status: 'cancelada',
          cancelled_at: new Date().toISOString(),
          cancelled_by: auth.user?.id ?? null,
          cancel_reason: reason,
        })
        .eq('id', id)
        .select(SALE_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as SaleWithCustomer;
    },
    onSuccess: (_data, vars) => {
      // Cancelación afecta exactamente las mismas keys que la creación.
      // No conocemos los orderIds afectados sin re-leer la venta —
      // invalidamos a nivel sucursal (helper sin orderIds).
      invalidateSaleWithStock(qc, sucursalId, { saleId: vars.id });
    },
  });
}
