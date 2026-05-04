import { describe, it, expect } from 'vitest';
import { openSessionSchema, closeSessionSchema, orderPaymentSchema } from './schemas';

describe('openSessionSchema', () => {
  it('accepts non-negative numbers', () => {
    expect(openSessionSchema.parse({ opening_amount: 0 })).toEqual({ opening_amount: 0 });
    expect(openSessionSchema.parse({ opening_amount: 100 })).toEqual({ opening_amount: 100 });
  });

  it('coerces numeric strings', () => {
    expect(openSessionSchema.parse({ opening_amount: '250.50' })).toEqual({ opening_amount: 250.5 });
  });

  it('rejects negatives', () => {
    expect(() => openSessionSchema.parse({ opening_amount: -1 })).toThrow();
  });
});

describe('closeSessionSchema', () => {
  it('accepts valid count without notes', () => {
    expect(closeSessionSchema.parse({ counted_cash: 500 })).toMatchObject({ counted_cash: 500 });
  });

  it('transforms empty notes to null', () => {
    const out = closeSessionSchema.parse({ counted_cash: 100, closing_notes: '   ' });
    expect(out.closing_notes).toBeNull();
  });

  it('keeps non-empty notes', () => {
    expect(
      closeSessionSchema.parse({ counted_cash: 100, closing_notes: 'cuadró exacto' }),
    ).toMatchObject({ closing_notes: 'cuadró exacto' });
  });

  it('rejects notes longer than 500 chars', () => {
    expect(() =>
      closeSessionSchema.parse({ counted_cash: 0, closing_notes: 'x'.repeat(501) }),
    ).toThrow();
  });

  it('rejects negative cash', () => {
    expect(() => closeSessionSchema.parse({ counted_cash: -10 })).toThrow();
  });
});

describe('orderPaymentSchema', () => {
  it('accepts positive amount with valid method', () => {
    expect(
      orderPaymentSchema.parse({ amount: 100, payment_method: 'efectivo' }),
    ).toMatchObject({ amount: 100, payment_method: 'efectivo' });
  });

  it('accepts the three valid methods', () => {
    for (const m of ['efectivo', 'tarjeta', 'transferencia'] as const) {
      expect(
        orderPaymentSchema.parse({ amount: 50, payment_method: m }),
      ).toMatchObject({ payment_method: m });
    }
  });

  it('rejects amount of zero', () => {
    expect(() =>
      orderPaymentSchema.parse({ amount: 0, payment_method: 'efectivo' }),
    ).toThrow();
  });

  it('rejects unknown payment method', () => {
    expect(() =>
      orderPaymentSchema.parse({ amount: 10, payment_method: 'crypto' }),
    ).toThrow();
  });

  it('transforms empty notes to null', () => {
    const out = orderPaymentSchema.parse({
      amount: 10,
      payment_method: 'efectivo',
      notes: '   ',
    });
    expect(out.notes).toBeNull();
  });
});
