import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { invalidateCustomerRelated } from '@/lib/queryInvalidation';
import { normalizePhone } from '@/lib/whatsapp';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { Customer } from './types';
import type { CustomerInput } from './schemas';

const CUSTOMER_COLUMNS = 'id, name, phone, email, notes, created_by, created_at, updated_at';

export function useCustomers(search = '') {
  const sucursalId = useScopedSucursalId();
  const trimmed = search.trim();
  return useQuery({
    queryKey: ['customers', sucursalId, trimmed],
    queryFn: async () => {
      let q = supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (trimmed) {
        const safe = trimmed.replace(/[,()]/g, ' ');
        const term = `%${safe}%`;
        q = q.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Customer[];
    },
    staleTime: trimmed ? STALE_TIMES.FAST : STALE_TIMES.SLOW,
  });
}

export function useCustomer(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['customer', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });
}

export function useCustomerActiveOrders(customerId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['customer-active-orders', sucursalId, customerId],
    queryFn: async () => {
      // No usamos count:'exact' (header extra + planner overhead). Pedimos
      // hasta 50 IDs y devolvemos el length — un cliente nunca debería
      // tener 50+ OS abiertas en simultáneo.
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('sucursal_id', sucursalId)
        .eq('customer_id', customerId!)
        .neq('status', 'entregado')
        .limit(50);
      if (error) throw error;
      return (data ?? []).length;
    },
    enabled: !!customerId,
    staleTime: STALE_TIMES.FAST,
  });
}

/**
 * Lista las OS entregadas del cliente dentro del periodo de garantía
 * de la sucursal. Usado por OrderFormPage para alertar cuando se crea
 * una nueva OS y el cliente ya tiene una reciente — probable reclamo
 * de garantía.
 */
export interface WarrantyEligibleOrder {
  id: string;
  folio: string;
  delivered_at: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  problem: string | null;
}

export function useCustomerWarrantyOrders(
  customerId: string | undefined,
  warrantyDays: number,
) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['customer-warranty-orders', sucursalId, customerId, warrantyDays],
    enabled: !!customerId && warrantyDays > 0,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - warrantyDays);
      const { data, error } = await supabase
        .from('orders')
        .select('id, folio, delivered_at, device_type, brand, model, problem')
        .eq('sucursal_id', sucursalId)
        .eq('customer_id', customerId!)
        .eq('status', 'entregado')
        .gte('delivered_at', cutoff.toISOString())
        .order('delivered_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as WarrantyEligibleOrder[];
    },
  });
}

export function useSaveCustomer() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CustomerInput }) => {
      const payload = {
        name: values.name.trim(),
        phone: normalizePhone(values.phone),
        email: values.email ?? null,
        notes: values.notes?.trim() || null,
      };

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      if (id) {
        const { data, error } = await supabase
          .from('customers')
          .update({ ...payload, updated_by: userId })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as Customer;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data) => {
      invalidateCustomerRelated(qc, sucursalId, { customerId: data.id });
    },
  });
}

export function useDeleteCustomer() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidateCustomerRelated(qc, sucursalId, { customerId: id });
    },
  });
}
