import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import { supportsDevicePassword } from './types';
import type { Order, OrderKind, OrderStatus, OrderWithCustomer } from './types';
import type { RepairOrderInput } from './schemas';
import type { ItemOrderInput } from './itemSchema';

const LIST_COLUMNS = `
  id, folio, customer_id, kind, device_type, brand, model, color, problem, item_description,
  device_password, cost, down_payment, status, received_at, estimated_delivery,
  delivered_at, notes, created_by, created_at, updated_at, warranty_claim_of,
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
      return (data ?? []) as unknown as OrderWithCustomer[];
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
      return data as unknown as OrderWithCustomer;
    },
    enabled: !!id,
    staleTime: 60_000,
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
      return data as unknown as Order[];
    },
    enabled: !!customerId,
    staleTime: 30_000,
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
    staleTime: 60_000,
  });
}

export function useSaveRepairOrder() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: RepairOrderInput }) => {
      const payload = {
        kind: 'reparacion' as const,
        customer_id: values.customer_id,
        device_type: values.device_type,
        brand: values.brand?.trim() || null,
        model: values.model?.trim() || null,
        color: values.color?.trim() || null,
        problem: values.problem.trim(),
        device_password: supportsDevicePassword(values.device_type)
          ? values.device_password?.trim() || null
          : null,
        cost: values.cost,
        down_payment: values.down_payment,
        estimated_delivery: values.estimated_delivery || null,
        notes: values.notes?.trim() || null,
        status: values.status,
        warranty_claim_of: values.warranty_claim_of ?? null,
      };

      if (id) {
        const { data: auth } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('orders')
          .update({ ...payload, updated_by: auth.user?.id })
          .eq('id', id)
          .select(LIST_COLUMNS)
          .single();
        if (error) throw error;
        return data as unknown as OrderWithCustomer;
      }

      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('orders')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: auth.user?.id,
          updated_by: auth.user?.id,
        })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as OrderWithCustomer;
    },
    onMutate: async ({ id, values }) => {
      if (!id) return { previous: undefined };
      await qc.cancelQueries({ queryKey: ['order', sucursalId, id] });
      const previous = qc.getQueryData<OrderWithCustomer>(['order', sucursalId, id]);
      if (previous) {
        qc.setQueryData<OrderWithCustomer>(['order', sucursalId, id], {
          ...previous,
          brand: values.brand?.trim() || null,
          model: values.model?.trim() || null,
          color: values.color?.trim() || null,
          problem: values.problem.trim(),
          cost: values.cost,
          down_payment: values.down_payment,
          estimated_delivery: values.estimated_delivery || null,
          notes: values.notes?.trim() || null,
          status: values.status,
        });
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (vars.id && ctx?.previous) qc.setQueryData(['order', sucursalId, vars.id], ctx.previous);
    },
    onSettled: (data, _err, vars) => {
      // Invalidamos solo la sucursal activa: una mutation en A no debe
      // forzar refetch de la cache de B (admin que opera 2 sucursales).
      qc.invalidateQueries({ queryKey: ['orders', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-agenda', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue-count', sucursalId] });
      if (data?.customer_id) {
        qc.invalidateQueries({ queryKey: ['customer-orders', sucursalId, data.customer_id] });
        qc.invalidateQueries({ queryKey: ['customer-active-orders', sucursalId, data.customer_id] });
      }
      if (vars.id) {
        qc.invalidateQueries({ queryKey: ['order', sucursalId, vars.id] });
        qc.invalidateQueries({ queryKey: ['order-balance', sucursalId, vars.id] });
      }
    },
  });
}

export function useSaveItemOrder(kind: 'encargo' | 'accesorio') {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ItemOrderInput }) => {
      const deviceType = kind === 'encargo' ? values.device_type ?? null : null;
      const payload = {
        kind,
        customer_id: values.customer_id,
        item_description: values.item_description.trim(),
        device_type: deviceType,
        device_password: supportsDevicePassword(deviceType)
          ? values.device_password?.trim() || null
          : null,
        cost: values.cost,
        down_payment: values.down_payment,
        estimated_delivery: values.estimated_delivery || null,
        notes: values.notes?.trim() || null,
        status: values.status,
      };
      const { data: auth } = await supabase.auth.getUser();

      if (id) {
        const { data, error } = await supabase
          .from('orders')
          .update({ ...payload, updated_by: auth.user?.id })
          .eq('id', id)
          .select(LIST_COLUMNS)
          .single();
        if (error) throw error;
        return data as unknown as OrderWithCustomer;
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: auth.user?.id,
          updated_by: auth.user?.id,
        })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as OrderWithCustomer;
    },
    onMutate: async ({ id, values }) => {
      if (!id) return { previous: undefined };
      await qc.cancelQueries({ queryKey: ['order', sucursalId, id] });
      const previous = qc.getQueryData<OrderWithCustomer>(['order', sucursalId, id]);
      if (previous) {
        qc.setQueryData<OrderWithCustomer>(['order', sucursalId, id], {
          ...previous,
          item_description: values.item_description.trim(),
          cost: values.cost,
          down_payment: values.down_payment,
          estimated_delivery: values.estimated_delivery || null,
          notes: values.notes?.trim() || null,
          status: values.status,
        });
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (vars.id && ctx?.previous) qc.setQueryData(['order', sucursalId, vars.id], ctx.previous);
    },
    onSettled: (data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['orders', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-agenda', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue-count', sucursalId] });
      if (data?.customer_id) {
        qc.invalidateQueries({ queryKey: ['customer-orders', sucursalId, data.customer_id] });
        qc.invalidateQueries({ queryKey: ['customer-active-orders', sucursalId, data.customer_id] });
      }
      if (vars.id) {
        qc.invalidateQueries({ queryKey: ['order', sucursalId, vars.id] });
        qc.invalidateQueries({ queryKey: ['order-balance', sucursalId, vars.id] });
      }
    },
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

export function useDeleteOrder() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['orders', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue-count', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-agenda', sucursalId] });
      qc.invalidateQueries({ queryKey: ['customer-orders', sucursalId] });
      qc.invalidateQueries({ queryKey: ['customer-active-orders', sucursalId] });
      qc.removeQueries({ queryKey: ['order', sucursalId, id] });
    },
  });
}

export function useUpdateOrderStatus() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_by: auth.user?.id })
        .eq('id', id)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw error;
      return data as unknown as OrderWithCustomer;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['orders', sucursalId] });
      const previous = qc.getQueriesData<OrderWithCustomer[]>({
        queryKey: ['orders', sucursalId],
      });
      qc.setQueriesData<OrderWithCustomer[]>(
        { queryKey: ['orders', sucursalId] },
        (old) => old?.map((o) => (o.id === id ? { ...o, status } : o)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['orders', sucursalId] });
      qc.invalidateQueries({ queryKey: ['order', sucursalId, vars.id] });
      qc.invalidateQueries({ queryKey: ['orders-overdue', sucursalId] });
      qc.invalidateQueries({ queryKey: ['orders-overdue-count', sucursalId] });
    },
  });
}
