import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { captureUnlessBenign } from './sentry';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      captureUnlessBenign(error, { queryKey: query.queryKey });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      captureUnlessBenign(error, { mutationKey: mutation.options.mutationKey });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 1,
    },
  },
});
