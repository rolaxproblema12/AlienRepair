import { describe, expect, it } from 'vitest';
import { itemOrderSchema } from './itemSchema';

const valid = {
  customer_id: '00000000-0000-0000-0000-000000000001',
  item_description: 'Funda iPhone 13 negra',
  cost: 200,
  down_payment: 0,
};

describe('itemOrderSchema', () => {
  it('acepta input mínimo válido', () => {
    expect(itemOrderSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza customer_id que no es uuid', () => {
    expect(
      itemOrderSchema.safeParse({ ...valid, customer_id: 'no-uuid' }).success,
    ).toBe(false);
  });

  it('rechaza descripción < 3 chars (incluso con espacios)', () => {
    expect(itemOrderSchema.safeParse({ ...valid, item_description: 'X' }).success).toBe(
      false,
    );
    expect(
      itemOrderSchema.safeParse({ ...valid, item_description: '   ab   ' }).success,
    ).toBe(false);
  });

  it('rechaza down_payment > cost', () => {
    expect(
      itemOrderSchema.safeParse({ ...valid, cost: 100, down_payment: 200 }).success,
    ).toBe(false);
  });

  it('acepta down_payment == cost', () => {
    expect(
      itemOrderSchema.safeParse({ ...valid, cost: 100, down_payment: 100 }).success,
    ).toBe(true);
  });

  it('coerce strings numéricos a número en cost/down_payment', () => {
    const r = itemOrderSchema.safeParse({
      ...valid,
      cost: '500',
      down_payment: '100',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBe(500);
      expect(r.data.down_payment).toBe(100);
    }
  });

  it('rechaza cost negativo', () => {
    expect(itemOrderSchema.safeParse({ ...valid, cost: -1 }).success).toBe(false);
  });

  it('estimated_delivery vacío se convierte a null', () => {
    const r = itemOrderSchema.safeParse({ ...valid, estimated_delivery: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.estimated_delivery).toBeNull();
  });

  it('status no incluye "diagnostico" (solo orders de reparación)', () => {
    expect(
      itemOrderSchema.safeParse({ ...valid, status: 'diagnostico' }).success,
    ).toBe(false);
  });

  it('status default es "pendiente"', () => {
    const r = itemOrderSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('pendiente');
  });
});
