import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { PartInput, PartMovementInput, UsePartOnOrderInput } from './schemas';
import type {
  Part,
  PartCategory,
  PartMovement,
  PartUsedOnOrder,
} from './types';

const PART_COLUMNS = `
  id, name, brand, model, category, cost_purchase, cost_sale, stock, min_stock,
  notes, active, created_at, updated_at, created_by, updated_by
`;

interface PartsFilter {
  search?: string;
  category?: PartCategory | 'all';
  brand?: string | 'all';
  lowStock?: boolean;
  includeInactive?: boolean;
}

export function useParts(filter: PartsFilter = {}) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['parts', sucursalId, filter],
    queryFn: async () => {
      let q = supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('sucursal_id', sucursalId)
        .order('name', { ascending: true })
        .limit(500);

      if (!filter.includeInactive) q = q.eq('active', true);
      if (filter.category && filter.category !== 'all') q = q.eq('category', filter.category);
      if (filter.brand && filter.brand !== 'all') q = q.eq('brand', filter.brand);

      const term = filter.search?.trim() ?? '';
      if (term) {
        const safe = term.replace(/[,()]/g, ' ');
        const like = `%${safe}%`;
        q = q.or(
          `name.ilike.${like},brand.ilike.${like},model.ilike.${like}`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as unknown as Part[];
      if (filter.lowStock) {
        rows = rows.filter((p) => p.min_stock != null && p.stock <= p.min_stock);
      }
      return rows;
    },
  });
}

export function usePart(id: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['part', sucursalId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Part;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function usePartBrands() {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['parts-brands', sucursalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('brand')
        .eq('sucursal_id', sucursalId)
        .order('brand', { ascending: true });
      if (error) throw error;
      const set = new Set<string>();
      for (const r of data ?? []) set.add((r as { brand: string }).brand);
      return Array.from(set).filter(Boolean);
    },
    staleTime: 5 * 60_000,
  });
}

export function useSavePart() {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PartInput }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const payload = {
        name: values.name.trim(),
        brand: values.brand.trim(),
        model: values.model.trim(),
        category: values.category,
        cost_purchase: values.cost_purchase,
        cost_sale: values.cost_sale,
        min_stock: values.min_stock ?? null,
        notes: values.notes ?? null,
        active: values.active,
      };

      if (id) {
        const { data, error } = await supabase
          .from('parts')
          .update({ ...payload, updated_by: userId })
          .eq('id', id)
          .select(PART_COLUMNS)
          .single();
        if (error) throw error;
        return data as unknown as Part;
      }

      const { data, error } = await supabase
        .from('parts')
        .insert({
          ...payload,
          sucursal_id: sucursalId,
          created_by: userId,
          updated_by: userId,
        })
        .select(PART_COLUMNS)
        .single();
      if (error) throw error;
      const part = data as unknown as Part;

      if (values.initial_stock && values.initial_stock > 0) {
        const { error: mvErr } = await supabase.from('part_movements').insert({
          part_id: part.id,
          sucursal_id: sucursalId,
          kind: 'entrada',
          quantity: values.initial_stock,
          unit_purchase_price: values.cost_purchase,
          reason: 'Stock inicial',
          created_by: userId,
        });
        if (mvErr) throw mvErr;
      }

      return part;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['parts-brands'] });
      qc.invalidateQueries({ queryKey: ['part'] });
      qc.invalidateQueries({ queryKey: ['part-movements'] });
    },
  });
}

export function useDeletePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('parts')
        .update({ active: false })
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['part'] });
    },
  });
}

// =====================================================
// Movimientos
// =====================================================

export function usePartMovements(partId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['part-movements', sucursalId, partId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('part_movements')
        .select(
          'id, part_id, kind, quantity, unit_purchase_price, unit_sale_price, order_id, sale_id, reason, reference, created_at, created_by',
        )
        .eq('part_id', partId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PartMovement[];
    },
    enabled: !!partId,
  });
}

export function useRecordPartMovement(partId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: PartMovementInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const { data: p, error: pErr } = await supabase
        .from('parts')
        .select('cost_purchase, cost_sale')
        .eq('id', partId)
        .single();
      if (pErr) throw pErr;

      const absQty = Math.abs(values.quantity);
      let signed: number;
      if (values.kind === 'entrada') signed = absQty;
      else if (values.kind === 'salida') signed = -absQty;
      else signed = values.quantity;

      const { data, error } = await supabase
        .from('part_movements')
        .insert({
          part_id: partId,
          sucursal_id: sucursalId,
          kind: values.kind,
          quantity: signed,
          unit_purchase_price: Number(p.cost_purchase),
          unit_sale_price: Number(p.cost_sale),
          reason: values.reason ?? null,
          reference: values.reference ?? null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PartMovement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['part'] });
      qc.invalidateQueries({ queryKey: ['part-movements'] });
    },
  });
}

// =====================================================
// Uso de pieza en una orden de reparación
// =====================================================

export function usePartsUsedOnOrder(orderId: string | undefined) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['order-parts', sucursalId, orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('part_movements')
        .select(
          'id, part_id, kind, quantity, unit_purchase_price, unit_sale_price, order_id, sale_id, reason, reference, created_at, created_by, part:parts(id, name, brand, model)',
        )
        .eq('order_id', orderId!)
        .eq('kind', 'salida')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PartUsedOnOrder[];
    },
    enabled: !!orderId,
  });
}

export function useAddPartToOrder(orderId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: UsePartOnOrderInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      // Snapshot del costo de compra al momento
      const { data: p, error: pErr } = await supabase
        .from('parts')
        .select('cost_purchase')
        .eq('id', values.part_id)
        .single();
      if (pErr) throw pErr;

      const { data, error } = await supabase
        .from('part_movements')
        .insert({
          part_id: values.part_id,
          sucursal_id: sucursalId,
          kind: 'salida',
          quantity: -Math.abs(values.quantity),
          unit_sale_price: values.unit_sale_price,
          unit_purchase_price: Number(p.cost_purchase),
          order_id: orderId,
          reason: values.notes
            ? `Uso en reparación · ${values.notes}`
            : 'Uso en reparación',
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PartMovement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['order-parts'] });
      qc.invalidateQueries({ queryKey: ['order-balance'] });
    },
  });
}

export function useRemovePartFromOrder(orderId: string) {
  const sucursalId = useScopedSucursalId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movementId: string) => {
      // Reverso: insertar ajuste positivo y marcar el movimiento original
      // Primero leer el movimiento original
      const { data: orig, error: oErr } = await supabase
        .from('part_movements')
        .select('part_id, quantity, unit_sale_price, unit_purchase_price, order_id')
        .eq('id', movementId)
        .single();
      if (oErr) throw oErr;

      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('part_movements').insert({
        part_id: orig.part_id,
        sucursal_id: sucursalId,
        kind: 'entrada',
        quantity: Math.abs(orig.quantity),
        unit_sale_price: orig.unit_sale_price,
        unit_purchase_price: orig.unit_purchase_price,
        order_id: null,
        reason: 'Reverso de uso en reparación',
        reference: 'REV',
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;

      // Borrar el movimiento original (rompe la asociación con la OS)
      // Solo admin puede DELETE, así que en la práctica esto puede fallar.
      // Alternativa: agregar columna 'voided_at' al movement.
      // De momento solo registramos el reverso.
      void orderId;
      return movementId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['order-parts'] });
      qc.invalidateQueries({ queryKey: ['order-balance'] });
    },
  });
}
