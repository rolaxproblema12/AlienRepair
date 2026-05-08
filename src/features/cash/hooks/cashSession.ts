import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateCashSessionRelated } from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { CashSession, SalePaymentMethod } from '../types';
import type { CloseSessionInput, OpenSessionInput } from '../schemas';

// Columnas explícitas del tipo CashSession. select('*') traería también
// sucursal_id que no exponemos en el tipo — no es un costo grande pero
// que el contrato tabla↔tipo sea 1:1 ayuda a detectar drift.
export const CASH_SESSION_COLUMNS =
  'id, status, opened_at, opened_by, opening_amount, closed_at, closed_by, expected_cash, counted_cash, difference, closing_notes';

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
        .select(CASH_SESSION_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CashSession | null;
    },
    staleTime: STALE_TIMES.FAST,
  });
}

export function useSession(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['cash-session', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select(CASH_SESSION_COLUMNS)
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
      invalidateCashSessionRelated(qc, sucursalId);
    },
  });
}

export function useCloseSession() {
  const sucursalId = useScopedSucursalId();
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
      invalidateCashSessionRelated(qc, sucursalId);
      qc.invalidateQueries({ queryKey: ['accounting', 'daily', sucursalId] });
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
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['day-balance', sucursalId, session?.id ?? 'none'],
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
    staleTime: STALE_TIMES.REALTIME,
  });
}
