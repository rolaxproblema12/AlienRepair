import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react';
import type { ReactNode } from 'react';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function withQueryClient(qc: QueryClient = makeQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

export function renderHookQ<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>,
): RenderHookResult<TResult, TProps> & { qc: QueryClient } {
  const qc = makeQueryClient();
  const result = renderHook(hook, { ...options, wrapper: withQueryClient(qc) });
  return Object.assign(result, { qc });
}
