import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { Order, OrderKind, OrderStatus, OrderWithCustomer } from '../types';
import { sanitizeIntakeChecklist } from '../schemas';

/**
 * Aplica safeParse al JSONB del checklist en cada row. Si el JSON viene
 * malformado (versión vieja, escritura manual), lo degrada a null en lugar
 * de propagar data inválida al UI/print.
 */
export function sanitizeOrderRow<T extends { intake_checklist?: unknown }>(
  row: T,
): T {
  if (row.intake_checklist == null) return row;
  return { ...row, intake_checklist: sanitizeIntakeChecklist(row.intake_checklist) };
}

export function sanitizeOrderRows<T extends { intake_checklist?: unknown }>(
  rows: T[],
): T[] {
  return rows.map(sanitizeOrderRow);
}

export const LIST_COLUMNS = `
  id, folio, customer_id, kind, device_type, brand, model, color, problem, item_description,
  device_password, cost, down_payment, status, received_at, estimated_delivery,
  delivered_at, notes, diagnosis, created_by, created_at, updated_at, warranty_claim_of,
  intake_checklist_applies, intake_checklist_reason, intake_checklist_reason_other,
  intake_checklist, warranty_void, warranty_void_reason,
  customer:customers!inner(id, name, phone)
`;

interface OrdersFilter {
  kind?: OrderKind | 'all';
  status?: OrderStatus | 'all';
  search?: string;
}

export function useOrders(filter: OrdersFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['orders', sucursalId, filter],
    queryFn: async () => {
      const term = filter.search?.trim() ?? '';

      // PostgREST no permite filtrar columnas de un embedded resource dentro
      // del mismo .or() que columnas del padre, así que primero buscamos
      // los customer_id que matchean por nombre y los inyectamos como IN.
      let customerIds: string[] = [];
      if (term) {
        const safe = term.replace(/[,()]/g, ' ');
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
        .select(LIST_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (filter.kind && filter.kind !== 'all') q = q.eq('kind', filter.kind);
      if (filter.status && filter.status !== 'all') q = q.eq('status', filter.status);

      if (term) {
        const safe = term.replace(/[,()]/g, ' ');
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
      return sanitizeOrderRows((data ?? []) as unknown as OrderWithCustomer[]);
    },
  });
}

export function useOrder(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(LIST_COLUMNS)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return sanitizeOrderRow(data as unknown as OrderWithCustomer);
    },
    enabled: !!id,
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useCustomerOrders(customerId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['customer-orders', sucursalId, customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(LIST_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return sanitizeOrderRows((data ?? []) as unknown as Order[]);
    },
    enabled: !!customerId,
    staleTime: STALE_TIMES.FAST,
  });
}

export function useOverdueOrdersCount() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['orders-overdue-count', sucursalId],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      // count:'estimated' (planner stats, exact si pocas rows). Evita
      // el seq scan del 'exact'. El badge tolera ±1; con el partial
      // index orders_sucursal_estimated_idx la diferencia es despreciable.
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'estimated', head: true })
        .eq('sucursal_id', sucursalId)
        .neq('status', 'listo')
        .neq('status', 'entregado')
        .lt('estimated_delivery', today);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useOverdueOrders() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['orders-overdue', sucursalId],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('orders')
        .select(LIST_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .neq('status', 'listo')
        .neq('status', 'entregado')
        .lt('estimated_delivery', today)
        .order('estimated_delivery', { ascending: true });
      if (error) throw error;
      return data as unknown as OrderWithCustomer[];
    },
  });
}

export function useAgendaOrders() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['orders-agenda', sucursalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(LIST_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .neq('status', 'entregado')
        .order('estimated_delivery', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as OrderWithCustomer[];
    },
  });
}

interface WarrantyFilter {
  search?: string;
  status?: 'all' | 'activas' | 'entregadas';
}

export interface WarrantyOrder extends OrderWithCustomer {
  original: { id: string; folio: string } | null;
}

/**
 * Listado de OS que son reclamos de garantía (warranty_claim_of != null).
 * Incluye un join opcional a la OS original para mostrar el folio padre.
 */
export function useWarrantyOrders(filter: WarrantyFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['warranty-orders', sucursalId, filter],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select(
          `${LIST_COLUMNS}, original:orders!warranty_claim_of(id, folio)`,
        )
        .eq('sucursal_id', sucursalId)
        .not('warranty_claim_of', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (filter.status === 'activas') {
        q = q.neq('status', 'entregado');
      } else if (filter.status === 'entregadas') {
        q = q.eq('status', 'entregado');
      }

      const term = filter.search?.trim() ?? '';
      if (term) {
        const safe = term.replace(/[,()]/g, ' ');
        const like = `%${safe}%`;
        q = q.or(
          `folio.ilike.${like},brand.ilike.${like},model.ilike.${like}`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return sanitizeOrderRows((data ?? []) as unknown as WarrantyOrder[]);
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}
