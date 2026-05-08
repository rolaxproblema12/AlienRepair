import { describe, expect, it } from 'vitest';
import {
  partMovementSchema,
  partSchema,
  usePartOnOrderSchema,
} from './schemas';

const validPart = {
  name: 'Pantalla iPhone 13',
  brand: 'Apple',
  model: 'iPhone 13',
  category: 'pantalla',
  cost_purchase: 800,
  cost_sale: 1500,
  initial_stock: 5,
};

describe('partSchema', () => {
  it('acepta entrada mínima válida', () => {
    expect(partSchema.safeParse(validPart).success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    expect(partSchema.safeParse({ ...validPart, name: '   ' }).success).toBe(false);
  });

  it('rechaza categoría fuera del enum', () => {
    expect(
      partSchema.safeParse({ ...validPart, category: 'inventada' }).success,
    ).toBe(false);
  });

  it('rechaza precios negativos', () => {
    expect(partSchema.safeParse({ ...validPart, cost_sale: -1 }).success).toBe(
      false,
    );
    expect(
      partSchema.safeParse({ ...validPart, cost_purchase: -10 }).success,
    ).toBe(false);
  });

  it('coerce strings numéricos a números', () => {
    const r = partSchema.safeParse({
      ...validPart,
      cost_purchase: '500',
      cost_sale: '1000',
      initial_stock: '3',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost_purchase).toBe(500);
      expect(r.data.cost_sale).toBe(1000);
      expect(r.data.initial_stock).toBe(3);
    }
  });

  it('initial_stock default 0', () => {
    const { initial_stock: _, ...rest } = validPart;
    const r = partSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.initial_stock).toBe(0);
  });

  it('min_stock acepta omitirlo y queda undefined', () => {
    const r = partSchema.safeParse(validPart);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.min_stock).toBeUndefined();
  });

  it('min_stock acepta número entero ≥ 0', () => {
    expect(partSchema.safeParse({ ...validPart, min_stock: 3 }).success).toBe(true);
  });

  it('min_stock rechaza negativos', () => {
    expect(partSchema.safeParse({ ...validPart, min_stock: -1 }).success).toBe(false);
  });

  it('notes vacío se transforma a null', () => {
    const r = partSchema.safeParse({ ...validPart, notes: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeNull();
  });

  it('active default true', () => {
    const r = partSchema.safeParse(validPart);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.active).toBe(true);
  });
});

describe('partMovementSchema', () => {
  it('acepta entrada/salida/ajuste con quantity ≠ 0', () => {
    expect(partMovementSchema.safeParse({ kind: 'entrada', quantity: 5 }).success).toBe(
      true,
    );
    expect(partMovementSchema.safeParse({ kind: 'salida', quantity: 2 }).success).toBe(
      true,
    );
    expect(partMovementSchema.safeParse({ kind: 'ajuste', quantity: -3 }).success).toBe(
      true,
    );
  });

  it('rechaza quantity = 0', () => {
    const r = partMovementSchema.safeParse({ kind: 'entrada', quantity: 0 });
    expect(r.success).toBe(false);
  });

  it('rechaza kind inválido', () => {
    const r = partMovementSchema.safeParse({ kind: 'mover', quantity: 1 });
    expect(r.success).toBe(false);
  });

  it('coerce quantity string a int', () => {
    const r = partMovementSchema.safeParse({ kind: 'entrada', quantity: '4' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(4);
  });
});

describe('usePartOnOrderSchema', () => {
  const valid = {
    part_id: '00000000-0000-0000-0000-000000000001',
    quantity: 1,
    unit_sale_price: 100,
  };

  it('acepta input válido', () => {
    expect(usePartOnOrderSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza part_id no-uuid', () => {
    expect(
      usePartOnOrderSchema.safeParse({ ...valid, part_id: 'abc' }).success,
    ).toBe(false);
  });

  it('rechaza quantity 0 o negativa', () => {
    expect(usePartOnOrderSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(usePartOnOrderSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(
      false,
    );
  });

  it('rechaza unit_sale_price negativo', () => {
    expect(
      usePartOnOrderSchema.safeParse({ ...valid, unit_sale_price: -10 }).success,
    ).toBe(false);
  });

  it('acepta unit_sale_price 0 (pieza incluida en el costo de la OS)', () => {
    expect(
      usePartOnOrderSchema.safeParse({ ...valid, unit_sale_price: 0 }).success,
    ).toBe(true);
  });
});
