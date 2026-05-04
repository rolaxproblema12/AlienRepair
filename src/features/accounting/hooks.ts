import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type {
  AccountingDailyRow,
  Expense,
  ExpenseKind,
  ExpenseWithOrder,
} from './types';
import type { ExpenseInput } from './schemas';

const EXPENSE_COLUMNS = `
  id, kind, order_id, description, amount, spent_at, notes,
  created_by, created_at, updated_at,
  order:orders(id, folio, kind)
`;

interface ExpenseFilter {
  kind?: ExpenseKind | 'all';
  from?: string;
  to?: string;
  orderId?: string;
}

export function useExpenses(filter: ExpenseFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['expenses', sucursalId, filter],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select(EXPENSE_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('spent_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (filter.kind && filter.kind !== 'all') q = q.eq('kind', filter.kind);
      if (filter.from) q = q.gte('spent_at', filter.from);
      if (filter.to) q = q.lte('spent_at', filter.to);
      if (filter.orderId) q = q.eq('order_id', filter.orderId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseWithOrder[];
    },
  });
}

export function useSaveExpense() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ExpenseInput }) => {
      const payload = {
        kind: values.kind,
        order_id: values.kind === 'refaccion' ? values.order_id : null,
        description: values.description.trim(),
        amount: values.amount,
        spent_at: values.spent_at,
        notes: values.notes?.trim() || null,
      };
      const { data: auth } = await supabase.auth.getUser();

      if (id) {
        const { data, error } = await supabase
          .from('expenses')
          .update({ ...payload, updated_by: auth.user?.id })
          .eq('id', id)
          .select(EXPENSE_COLUMNS)
          .single();
        if (error) throw error;
        return data as unknown as ExpenseWithOrder;
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: auth.user?.id,
          updated_by: auth.user?.id,
        })
        .select(EXPENSE_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as ExpenseWithOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'daily'] });
      qc.invalidateQueries({ queryKey: ['dashboard-revenue-7d'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'daily'] });
      qc.invalidateQueries({ queryKey: ['dashboard-revenue-7d'] });
    },
  });
}

export function useAccountingDaily(from: string, to: string) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['accounting', 'daily', sucursalId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_accounting_daily')
        .select('*')
        .eq('sucursal_id', sucursalId)
        .gte('dia', from)
        .lte('dia', to)
        .order('dia', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AccountingDailyRow[];
    },
  });
}

export interface OrderForExpenseRow {
  id: string;
  folio: string;
  kind: 'reparacion' | 'encargo' | 'accesorio';
  item_description: string | null;
  brand: string | null;
  model: string | null;
  customer: { name: string } | null;
}

const ORDER_FOR_EXPENSE_COLUMNS =
  'id, folio, kind, item_description, brand, model, customer:customers!inner(name)';

export function useOrdersForExpenseSearch(search = '') {
  const sucursalId = useScopedSucursalId();
  const trimmed = search.trim();
  return useQuery({
    queryKey: ['orders', 'for-expense', sucursalId, trimmed],
    queryFn: async () => {
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
        .select(ORDER_FOR_EXPENSE_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(20);

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
      return (data ?? []) as unknown as OrderForExpenseRow[];
    },
    staleTime: trimmed ? 30_000 : 2 * 60_000,
  });
}

export function useOrderForExpense(id: string | null | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order-for-expense', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_FOR_EXPENSE_COLUMNS)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as OrderForExpenseRow;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export type { Expense };
