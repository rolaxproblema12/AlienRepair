import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateOrderRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { OrderBalance, OrderPayment } from '../types';
import type { OrderPaymentInput } from '../schemas';

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
    staleTime: STALE_TIMES.FAST,
  });
}

export function useOrderPayments(orderId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order-payments', sucursalId, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_payments')
        .select(
          'id, order_id, sale_id, sucursal_id, amount, payment_method, cash_session_id, notes, created_by, created_at',
        )
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderPayment[];
    },
    enabled: !!orderId,
    staleTime: STALE_TIMES.FAST,
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
      // Abono a OS: invalida balance/payments de la OS + day-balance + accounting.
      invalidateOrderRelated(qc, sucursalId, { orderId, accountingAffected: true });
      qc.invalidateQueries({ queryKey: ['day-balance', sucursalId] });
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

      // Cruzar con balance — filtramos balance > 0 server-side para no
      // traer rows que vamos a descartar (vs antes: traíamos todas y
      // filtrábamos en cliente).
      const ids = (data ?? []).map((o: { id: string }) => o.id);
      if (!ids.length) return [];
      const { data: balances, error: bErr } = await supabase
        .from('v_order_balance')
        .select('order_id, base_cost, parts_total, total, paid, balance')
        .in('order_id', ids)
        .gt('balance', 0);
      if (bErr) throw bErr;
      const balMap = new Map<string, OrderBalance>(
        (balances ?? []).map((b) => [b.order_id, b as OrderBalance]),
      );

      // Solo devolvemos órdenes que aparecen en balMap (balance > 0).
      return (data ?? [])
        .filter((o) => balMap.has(o.id))
        .map((o) => {
          const bal = balMap.get(o.id)!;
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
            balance: bal.balance,
            paid: bal.paid,
            total: bal.total,
          };
        });
    },
    staleTime: STALE_TIMES.FAST,
  });
}
