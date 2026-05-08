import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { STALE_TIMES } from '@/lib/queryConfig';
import { DEFAULT_MARKUP_MULTIPLIER, type CatalogProduct } from './types';

const CATALOG_QUERY_KEY = ['catalog'] as const;
const MARKUP_QUERY_KEY = ['app-settings', 'catalog_markup_multiplier'] as const;
const LAST_UPDATE_LS_KEY = 'catalog:last-update';
const REFRESH_EVENT = 'catalog:last-update-changed';

export function useCatalog() {
  return useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: async (): Promise<CatalogProduct[]> => {
      try {
        const userData = await window.alien.catalog.readUserData();
        if (Array.isArray(userData) && userData.length > 0) {
          return userData as CatalogProduct[];
        }
      } catch {
        // ignore — fall back to bundled
      }
      // Dynamic import: el JSON queda en un chunk separado y se carga
      // solo cuando se monta CatalogPage o CatalogSuggestions, no en el
      // bundle inicial.
      const bundled = await import('../../../data/fixoem-catalog.json');
      return ((bundled as { default?: CatalogProduct[] }).default ??
        (bundled as unknown as CatalogProduct[])) as CatalogProduct[];
    },
    staleTime: STALE_TIMES.VERY_SLOW,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function useRefreshCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await window.alien.catalog.refresh();
      if (!result.ok) throw new Error('Refresh falló');
      const ts = new Date().toISOString();
      localStorage.setItem(LAST_UPDATE_LS_KEY, ts);
      window.dispatchEvent(new Event(REFRESH_EVENT));
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

export function useLastCatalogUpdate() {
  const [ts, setTs] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_UPDATE_LS_KEY) : null,
  );
  useEffect(() => {
    function refresh() {
      setTs(localStorage.getItem(LAST_UPDATE_LS_KEY));
    }
    window.addEventListener(REFRESH_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(REFRESH_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!ts) return { date: null as Date | null, daysAgo: null as number | null, isStale: false };
  const date = new Date(ts);
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  return { date, daysAgo, isStale: daysAgo > 30 };
}

export function useMarkupSetting() {
  return useQuery({
    queryKey: MARKUP_QUERY_KEY,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'catalog_markup_multiplier')
        .maybeSingle();
      if (error) throw error;
      const parsed = data?.value ? Number(data.value) : DEFAULT_MARKUP_MULTIPLIER;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MARKUP_MULTIPLIER;
    },
    staleTime: STALE_TIMES.SLOW,
  });
}

export function useUpdateMarkupSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (multiplier: number) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('app_settings').upsert(
        {
          key: 'catalog_markup_multiplier',
          value: String(multiplier),
          description:
            'Multiplicador del precio de compra para sugerir precio de venta.',
          updated_by: auth.user?.id ?? null,
        },
        { onConflict: 'key' },
      );
      if (error) throw error;
      return multiplier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MARKUP_QUERY_KEY });
    },
  });
}
