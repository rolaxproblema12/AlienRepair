import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/features/auth/AuthProvider';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';

export interface AccessCode {
  code: string;
  role_to_grant: UserRole;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  commission_rate: number;
}

export interface StatusAuditRow {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by: string | null;
  order: { folio: string; kind: 'reparacion' | 'encargo' | 'accesorio' } | null;
  actor: { email: string | null; full_name: string | null } | null;
}

const ACCESS_CODE_COLUMNS =
  'code, role_to_grant, created_by, used_by, used_at, expires_at, created_at';

const PROFILE_COLUMNS =
  'id, email, full_name, role, active, created_at, commission_rate';

function randomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function useAccessCodes() {
  return useQuery({
    queryKey: ['admin', 'access-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_codes')
        .select(ACCESS_CODE_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AccessCode[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useGenerateAccessCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role: UserRole; expiresAt: string | null }) => {
      const code = randomCode(8);
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('access_codes')
        .insert({
          code,
          role_to_grant: input.role,
          expires_at: input.expiresAt,
          created_by: auth.user?.id,
        })
        .select(ACCESS_CODE_COLUMNS)
        .single();
      if (error) throw error;
      return data as AccessCode;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'access-codes'] });
    },
  });
}

export function useDeleteAccessCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from('access_codes').delete().eq('code', code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'access-codes'] });
    },
  });
}

export function useAdminProfiles() {
  return useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminProfile[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      active?: boolean;
      role?: UserRole;
      commission_rate?: number;
    }) => {
      const payload: Record<string, unknown> = {};
      if (input.active !== undefined) payload.active = input.active;
      if (input.role) payload.role = input.role;
      if (input.commission_rate !== undefined) {
        payload.commission_rate = input.commission_rate;
      }
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', input.id)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw error;
      return data as AdminProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'profiles'] });
    },
  });
}

export function useStatusAudit(limit = 200) {
  const sucursalId = useScopedSucursalId();
  return useQuery({
    queryKey: ['admin', 'status-audit', sucursalId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_status_history')
        .select(
          `id, order_id, from_status, to_status, changed_at, changed_by,
           order:orders(folio, kind),
           actor:profiles!order_status_history_changed_by_fkey(email, full_name)`
        )
        .eq('sucursal_id', sucursalId)
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as StatusAuditRow[];
    },
    staleTime: 5 * 60_000,
  });
}
