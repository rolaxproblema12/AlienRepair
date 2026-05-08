import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  invalidateOrderRelated,
  removeOrderRelated,
} from '@/lib/queryInvalidation';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import { supportsDevicePassword } from '../types';
import type { OrderStatus, OrderWithCustomer } from '../types';
import type { RepairOrderInput } from '../schemas';
import type { ItemOrderInput } from '../itemSchema';
import { LIST_COLUMNS } from './queries';

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
        intake_checklist_applies: values.intake_checklist_applies,
        intake_checklist_reason:
          values.intake_checklist_applies === false ? values.intake_checklist_reason : null,
        intake_checklist_reason_other:
          values.intake_checklist_applies === false &&
          values.intake_checklist_reason === 'otro'
            ? values.intake_checklist_reason_other?.trim() || null
            : null,
        intake_checklist:
          values.intake_checklist_applies === true ? values.intake_checklist : null,
        warranty_void: values.warranty_void,
        warranty_void_reason: values.warranty_void
          ? values.warranty_void_reason?.trim() || null
          : null,
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
        // Optimistic con TODOS los campos del payload — si solo seteamos un
        // subset y la mutation falla, el rollback dejaría estado mezclado.
        qc.setQueryData<OrderWithCustomer>(['order', sucursalId, id], {
          ...previous,
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
          intake_checklist_applies: values.intake_checklist_applies,
          intake_checklist_reason:
            values.intake_checklist_applies === false ? values.intake_checklist_reason : null,
          intake_checklist_reason_other:
            values.intake_checklist_applies === false &&
            values.intake_checklist_reason === 'otro'
              ? values.intake_checklist_reason_other?.trim() || null
              : null,
          intake_checklist:
            values.intake_checklist_applies === true ? values.intake_checklist : null,
          warranty_void: values.warranty_void,
          warranty_void_reason: values.warranty_void
            ? values.warranty_void_reason?.trim() || null
            : null,
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
      invalidateOrderRelated(qc, sucursalId, {
        orderId: vars.id,
        customerId: data?.customer_id,
      });
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
        const deviceType = kind === 'encargo' ? values.device_type ?? null : null;
        // Optimistic con TODOS los campos del payload (ver comentario en useSaveRepairOrder).
        qc.setQueryData<OrderWithCustomer>(['order', sucursalId, id], {
          ...previous,
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
        });
      }
      return { previous };
    },
    onError: (_err, vars, ctx) => {
      if (vars.id && ctx?.previous) qc.setQueryData(['order', sucursalId, vars.id], ctx.previous);
    },
    onSettled: (data, _err, vars) => {
      invalidateOrderRelated(qc, sucursalId, {
        orderId: vars.id,
        customerId: data?.customer_id,
      });
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
      removeOrderRelated(qc, sucursalId, id);
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
    onSettled: (data, _err, vars) => {
      // accountingAffected: cualquier cambio de status puede afectar el
      // reporte de accounting. Antes intentábamos detectar transición
      // a/desde 'entregado' comparando data.status (estado nuevo) con
      // vars.status (también nuevo) — siempre era falso para reaperturas.
      // Costo de invalidar siempre: un fetch extra por cambio de status,
      // despreciable. Beneficio: reabrir una OS sí actualiza accounting.
      invalidateOrderRelated(qc, sucursalId, {
        orderId: vars.id,
        customerId: data?.customer_id,
        accountingAffected: true,
      });
    },
  });
}
