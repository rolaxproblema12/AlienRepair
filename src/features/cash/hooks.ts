import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type {
  CartLine,
  CashSession,
  OrderBalance,
  OrderPayment,
  SaleDetail,
  SaleItem,
  SalePaymentMethod,
  SaleWithCustomer,
} from './types';
import { calcLineTotal } from './types';
import type {
  CloseSessionInput,
  OpenSessionInput,
  OrderPaymentInput,
} from './schemas';

const SALE_COLUMNS = `
  id, folio, cash_session_id, customer_id, subtotal, iva_total, discount_total,
  total, payment_method, notes, status, cancelled_at, cancelled_by, cancel_reason,
  created_at, created_by,
  customer:customers(id, name, phone)
`;

// =====================================================
// Sesión de caja
// =====================================================

export function useCurrentSession() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['cash-session', sucursalId, 'current'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CashSession | null;
    },
    staleTime: 30_000,
  });
}

export function useSession(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['cash-session', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as CashSession;
    },
    enabled: !!id,
  });
}

export function useOpenSession() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: OpenSessionInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          sucursal_id: sucursalId,
          opening_amount: values.opening_amount,
          opened_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CashSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session'] });
    },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      values,
      expectedCash,
    }: {
      sessionId: string;
      values: CloseSessionInput;
      expectedCash: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const difference = Number(values.counted_cash) - expectedCash;
      const { data, error } = await supabase
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: auth.user?.id ?? null,
          expected_cash: expectedCash,
          counted_cash: values.counted_cash,
          difference,
          closing_notes: values.closing_notes ?? null,
        })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return data as CashSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-session'] });
      qc.invalidateQueries({ queryKey: ['day-balance'] });
    },
  });
}

// =====================================================
// Saldo del día
// =====================================================

export interface DayBalance {
  totalSales: number;
  byMethod: Record<SalePaymentMethod, number>;
  cancelledTotal: number;
  cashExpected: number; // opening_amount + ventas en efectivo - cancelaciones efectivo
  salesCount: number;
}

export function useDayBalance(session: CashSession | null | undefined) {
  return useQuery({
    queryKey: ['day-balance', session?.id ?? 'none'],
    queryFn: async () => {
      const empty: DayBalance = {
        totalSales: 0,
        byMethod: { efectivo: 0, tarjeta: 0, transferencia: 0 },
        cancelledTotal: 0,
        cashExpected: 0,
        salesCount: 0,
      };
      if (!session) return empty;

      const { data, error } = await supabase
        .from('sales')
        .select('total, payment_method, status')
        .eq('cash_session_id', session.id);
      if (error) throw error;

      const acc: DayBalance = { ...empty, byMethod: { ...empty.byMethod } };
      for (const r of data ?? []) {
        const total = Number(r.total);
        if (r.status === 'cancelada') {
          acc.cancelledTotal += total;
          continue;
        }
        acc.totalSales += total;
        acc.salesCount += 1;
        acc.byMethod[r.payment_method as SalePaymentMethod] += total;
      }
      acc.cashExpected = Number(session.opening_amount) + acc.byMethod.efectivo;
      return acc;
    },
    enabled: !!session,
    staleTime: 15_000,
  });
}

// =====================================================
// Ventas
// =====================================================

interface SalesFilter {
  search?: string;
  from?: string;
  to?: string;
  paymentMethod?: SalePaymentMethod | 'all';
  status?: 'all' | 'completada' | 'cancelada';
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
      const [{ data: sale, error: e1 }, { data: items, error: e2 }] = await Promise.all([
        supabase.from('sales').select(SALE_COLUMNS).eq('id', id!).single(),
        supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', id!)
          .order('id'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        ...(sale as unknown as SaleWithCustomer),
        items: (items ?? []) as SaleItem[],
      } as SaleDetail;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

interface CreateSaleInput {
  cashSessionId: string;
  customerId: string | null;
  paymentMethod: SalePaymentMethod;
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
          payment_method: input.paymentMethod,
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

      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['day-balance'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['order-balance'] });
      qc.invalidateQueries({ queryKey: ['order-payments'] });
    },
  });
}

export function useCancelSale() {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sale'] });
      qc.invalidateQueries({ queryKey: ['day-balance'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['order-balance'] });
      qc.invalidateQueries({ queryKey: ['order-payments'] });
    },
  });
}

// =====================================================
// Pagos a órdenes (cobrar reparación standalone)
// =====================================================

export function useOrderBalance(orderId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order-balance', sucursalId, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_order_balance')
        .select('*')
        .eq('order_id', orderId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OrderBalance | null;
    },
    enabled: !!orderId,
    staleTime: 30_000,
  });
}

export function useOrderPayments(orderId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order-payments', sucursalId, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderPayment[];
    },
    enabled: !!orderId,
  });
}

export function useAddOrderPayment(orderId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: OrderPaymentInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // Buscar sesión abierta de ESTA sucursal para vincular
      const { data: session } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('sucursal_id', sucursalId)
        .eq('status', 'open')
        .maybeSingle();

      const { data, error } = await supabase
        .from('order_payments')
        .insert({
          sucursal_id: sucursalId,
          order_id: orderId,
          cash_session_id: session?.id ?? null,
          amount: values.amount,
          payment_method: values.payment_method,
          notes: values.notes ?? null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrderPayment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order-payments'] });
      qc.invalidateQueries({ queryKey: ['order-balance'] });
      qc.invalidateQueries({ queryKey: ['day-balance'] });
    },
  });
}

// =====================================================
// Buscar órdenes con saldo pendiente (para el picker)
// =====================================================

export function useOrdersWithBalance(search = '') {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['orders-with-balance', sucursalId, search.trim()],
    queryFn: async () => {
      const trimmed = search.trim();
      let customerIds: string[] = [];
      if (trimmed) {
        const safe = trimmed.replace(/[,()]/g, ' ');
        const { data: cs, error: cErr } = await supabase
          .from('customers')
          .select('id')
          .eq('sucursal_id', sucursalId)
          .ilike('name', `%${safe}%`)
          .limit(500);
        if (cErr) throw cErr;
        customerIds = (cs ?? []).map((c) => (c as { id: string }).id);
      }

      let q = supabase
        .from('orders')
        .select(
          'id, folio, kind, brand, model, item_description, cost, down_payment, status, customer:customers!inner(id, name, phone)',
        )
        .eq('sucursal_id', sucursalId)
        .neq('status', 'entregado')
        .order('created_at', { ascending: false })
        .limit(50);
      if (trimmed) {
        const safe = trimmed.replace(/[,()]/g, ' ');
        const like = `%${safe}%`;
        const orParts = [
          `folio.ilike.${like}`,
          `brand.ilike.${like}`,
          `model.ilike.${like}`,
          `item_description.ilike.${like}`,
        ];
        if (customerIds.length) {
          orParts.push(`customer_id.in.(${customerIds.join(',')})`);
        }
        q = q.or(orParts.join(','));
      }
      const { data, error } = await q;
      if (error) throw error;

      // Cruzar con balance
      const ids = (data ?? []).map((o: { id: string }) => o.id);
      if (!ids.length) return [];
      const { data: balances, error: bErr } = await supabase
        .from('v_order_balance')
        .select('*')
        .in('order_id', ids);
      if (bErr) throw bErr;
      const balMap = new Map<string, OrderBalance>(
        (balances ?? []).map((b) => [b.order_id, b as OrderBalance]),
      );

      return (data ?? [])
        .map((o) => {
          const bal = balMap.get(o.id);
          return {
            ...(o as unknown as {
              id: string;
              folio: string;
              kind: 'reparacion' | 'encargo' | 'accesorio';
              brand: string | null;
              model: string | null;
              item_description: string | null;
              cost: number;
              down_payment: number;
              status: string;
              customer: { id: string; name: string; phone: string };
            }),
            balance: bal?.balance ?? Number(o.cost) - Number(o.down_payment ?? 0),
            paid: bal?.paid ?? Number(o.down_payment ?? 0),
            total: bal?.total ?? Number(o.cost),
          };
        })
        .filter((o) => o.balance > 0);
    },
    staleTime: 30_000,
  });
}

