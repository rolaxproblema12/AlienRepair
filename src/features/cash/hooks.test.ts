import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookQ } from '@/test/helpers';
import { TEST_SUCURSAL_ID } from '@/test/mocks/sucursalStore';

// Mock sucursal scope
vi.mock('@/features/sucursales/useScopedSucursalId', () => ({
  useScopedSucursalId: () => TEST_SUCURSAL_ID,
}));

// Mock supabase con un chainable completamente programable
const mockSession = { id: 'sess-1', sucursal_id: TEST_SUCURSAL_ID, opening_amount: 100 };
const supabaseChain = {
  from: vi.fn(() => supabaseChain),
  select: vi.fn(() => supabaseChain),
  insert: vi.fn(() => supabaseChain),
  update: vi.fn(() => supabaseChain),
  delete: vi.fn(() => supabaseChain),
  eq: vi.fn(() => supabaseChain),
  neq: vi.fn(() => supabaseChain),
  gte: vi.fn(() => supabaseChain),
  lte: vi.fn(() => supabaseChain),
  in: vi.fn(() => supabaseChain),
  ilike: vi.fn(() => supabaseChain),
  or: vi.fn(() => supabaseChain),
  order: vi.fn(() => supabaseChain),
  limit: vi.fn(() => supabaseChain),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  then: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseChain.from(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabaseChain.from.mockReturnValue(supabaseChain);
  supabaseChain.select.mockReturnValue(supabaseChain);
  supabaseChain.insert.mockReturnValue(supabaseChain);
  supabaseChain.update.mockReturnValue(supabaseChain);
  supabaseChain.delete.mockReturnValue(supabaseChain);
  supabaseChain.eq.mockReturnValue(supabaseChain);
  supabaseChain.neq.mockReturnValue(supabaseChain);
  supabaseChain.gte.mockReturnValue(supabaseChain);
  supabaseChain.lte.mockReturnValue(supabaseChain);
  supabaseChain.in.mockReturnValue(supabaseChain);
  supabaseChain.ilike.mockReturnValue(supabaseChain);
  supabaseChain.or.mockReturnValue(supabaseChain);
  supabaseChain.order.mockReturnValue(supabaseChain);
  supabaseChain.limit.mockReturnValue(supabaseChain);
});

describe('useOpenSession', () => {
  it('inserts cash_session with sucursal_id and opening_amount', async () => {
    const { useOpenSession } = await import('./hooks');
    supabaseChain.single.mockResolvedValueOnce({ data: mockSession, error: null });

    const { result } = renderHookQ(() => useOpenSession());
    await result.current.mutateAsync({ opening_amount: 100 });

    expect(supabaseChain.from).toHaveBeenCalledWith('cash_sessions');
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        sucursal_id: TEST_SUCURSAL_ID,
        opening_amount: 100,
        opened_by: 'user-1',
      }),
    );
  });

  it('throws when supabase returns an error', async () => {
    const { useOpenSession } = await import('./hooks');
    supabaseChain.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

    const { result } = renderHookQ(() => useOpenSession());
    await expect(result.current.mutateAsync({ opening_amount: 100 })).rejects.toMatchObject({
      message: 'fail',
    });
  });
});

describe('useCloseSession', () => {
  it('calculates difference and updates session', async () => {
    const { useCloseSession } = await import('./hooks');
    supabaseChain.single.mockResolvedValueOnce({
      data: { ...mockSession, status: 'closed' },
      error: null,
    });

    const { result } = renderHookQ(() => useCloseSession());
    await result.current.mutateAsync({
      sessionId: 'sess-1',
      values: { counted_cash: 530 },
      expectedCash: 500,
    });

    expect(supabaseChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'closed',
        expected_cash: 500,
        counted_cash: 530,
        difference: 30,
        closed_by: 'user-1',
      }),
    );
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', 'sess-1');
  });

  it('handles negative difference (faltante)', async () => {
    const { useCloseSession } = await import('./hooks');
    supabaseChain.single.mockResolvedValueOnce({ data: mockSession, error: null });

    const { result } = renderHookQ(() => useCloseSession());
    await result.current.mutateAsync({
      sessionId: 'sess-1',
      values: { counted_cash: 480 },
      expectedCash: 500,
    });

    expect(supabaseChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ difference: -20 }),
    );
  });
});

describe('useDayBalance', () => {
  it('does not run when session is null (enabled: false)', async () => {
    const { useDayBalance } = await import('./hooks');
    const { result } = renderHookQ(() => useDayBalance(null));
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(supabaseChain.from).not.toHaveBeenCalledWith('sales');
  });

  it('aggregates sales by payment method, excludes cancelled', async () => {
    const { useDayBalance } = await import('./hooks');
    supabaseChain.eq.mockReturnValueOnce(
      Promise.resolve({
        data: [
          { total: 100, payment_method: 'efectivo', status: 'completada' },
          { total: 50, payment_method: 'tarjeta', status: 'completada' },
          { total: 30, payment_method: 'efectivo', status: 'completada' },
          { total: 999, payment_method: 'efectivo', status: 'cancelada' },
        ],
        error: null,
      }) as unknown as typeof supabaseChain,
    );

    const { result } = renderHookQ(() =>
      useDayBalance({ id: 'sess-1', opening_amount: 200 } as never),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      totalSales: 180,
      salesCount: 3,
      cancelledTotal: 999,
      byMethod: { efectivo: 130, tarjeta: 50, transferencia: 0 },
      cashExpected: 330, // opening 200 + efectivo 130
    });
  });
});

describe('useCreateSale', () => {
  it('computes totals and inserts sale + sale_items + sale_payments with sucursal_id', async () => {
    const { useCreateSale } = await import('./hooks');
    const created = { id: 'sale-1', folio: 'CM-0001' };
    supabaseChain.single.mockResolvedValueOnce({ data: created, error: null });
    // 1ª insert (sales) chainea select+single, 2ª (items) y 3ª (payments) son await directo.
    supabaseChain.insert
      .mockImplementationOnce(() => supabaseChain)
      .mockResolvedValueOnce({ data: null, error: null } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);

    const { result } = renderHookQ(() => useCreateSale());
    await result.current.mutateAsync({
      cashSessionId: 'sess-1',
      customerId: null,
      // 2 × $100 = $200 (iva incluido). useCreateSale valida que sum(payments)
      // = total (con tolerancia de 1 cent), así que el monto debe coincidir.
      payments: [{ payment_method: 'efectivo', amount: 200 }],
      notes: null,
      lines: [
        {
          key: 'k1',
          kind: 'producto',
          product_id: 'p1',
          order_id: null,
          description: 'Cargador',
          quantity: 2,
          unit_price: 100,
          unit_cost: 50,
          iva_rate: 0.16,
          discount: 0,
          stock_available: 10,
        },
      ],
    });

    expect(supabaseChain.from).toHaveBeenCalledWith('sales');
    expect(supabaseChain.from).toHaveBeenCalledWith('sale_items');
    expect(supabaseChain.from).toHaveBeenCalledWith('sale_payments');
  });

  // El test de rollback (sale_items insert falla → delete de sale huérfana)
  // requiere un mock más sofisticado del chainable porque insert se usa en
  // dos modos (chain con .select().single() vs await directo). Esa cobertura
  // queda mejor en los e2e (paso 10).
});

describe('useCancelSale', () => {
  it('updates sale status to cancelada with reason', async () => {
    const { useCancelSale } = await import('./hooks');
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 's1' }, error: null });

    const { result } = renderHookQ(() => useCancelSale());
    await result.current.mutateAsync({ id: 's1', reason: 'cliente arrepentido' });

    expect(supabaseChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cancelada',
        cancel_reason: 'cliente arrepentido',
        cancelled_by: 'user-1',
      }),
    );
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', 's1');
  });
});

describe('useAddOrderPayment', () => {
  it('looks up open session and links the payment', async () => {
    const { useAddOrderPayment } = await import('./hooks');
    // Primer maybeSingle: sesión abierta encontrada
    supabaseChain.maybeSingle.mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null });
    // Segundo single: payment insertado
    supabaseChain.single.mockResolvedValueOnce({
      data: { id: 'pay-1', amount: 200 },
      error: null,
    });

    const { result } = renderHookQ(() => useAddOrderPayment('order-99'));
    await result.current.mutateAsync({ amount: 200, payment_method: 'efectivo' });

    expect(supabaseChain.from).toHaveBeenCalledWith('cash_sessions');
    expect(supabaseChain.from).toHaveBeenCalledWith('order_payments');
    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        sucursal_id: TEST_SUCURSAL_ID,
        order_id: 'order-99',
        cash_session_id: 'sess-1',
        amount: 200,
        payment_method: 'efectivo',
        created_by: 'user-1',
      }),
    );
  });

  it('inserts with cash_session_id null when no session is open', async () => {
    const { useAddOrderPayment } = await import('./hooks');
    supabaseChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'pay-2' }, error: null });

    const { result } = renderHookQ(() => useAddOrderPayment('order-99'));
    await result.current.mutateAsync({ amount: 50, payment_method: 'transferencia' });

    expect(supabaseChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ cash_session_id: null }),
    );
  });
});
