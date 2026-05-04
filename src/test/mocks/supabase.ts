import { vi } from 'vitest';

type Result<T = unknown> = { data: T | null; error: unknown };

export interface ChainableMock {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (cb: (r: Result) => unknown) => Promise<unknown>;
}

export function createChainableMock<T = unknown>(result: Result<T> = { data: null, error: null }): ChainableMock {
  const chain = {} as ChainableMock;
  const methods: Array<keyof ChainableMock> = [
    'from', 'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gte', 'lte', 'ilike', 'or', 'in', 'is',
    'order', 'limit', 'range',
  ];
  for (const m of methods) {
    (chain as Record<string, unknown>)[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (cb: (r: Result) => unknown) => Promise.resolve(result).then(cb);
  return chain;
}

export function createSupabaseMock<T = unknown>(result: Result<T> = { data: null, error: null }) {
  const chain = createChainableMock(result);
  const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chain,
    channelMock,
    supabase: {
      from: chain.from,
      channel: vi.fn(() => channelMock),
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        exchangeCodeForSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      rpc: vi.fn(() => Promise.resolve(result)),
    },
  };
}
