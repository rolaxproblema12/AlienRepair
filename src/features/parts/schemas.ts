import { z } from 'zod';
import { PART_CATEGORIES } from './types';

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const partSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(200),
  brand: z.string().trim().min(1, 'Marca requerida').max(80),
  model: z.string().trim().min(1, 'Modelo requerido').max(120),
  category: z.enum(PART_CATEGORIES as [string, ...string[]]),
  cost_purchase: z.coerce.number().nonnegative('Debe ser ≥ 0'),
  cost_sale: z.coerce.number().nonnegative('Debe ser ≥ 0'),
  min_stock: z
    .union([z.coerce.number().int().nonnegative(), z.literal('').transform(() => null)])
    .nullable()
    .optional(),
  initial_stock: z.coerce.number().int().nonnegative().default(0),
  notes: optionalText,
  active: z.boolean().default(true),
});

export type PartInput = z.infer<typeof partSchema>;

export const partMovementSchema = z.object({
  kind: z.enum(['entrada', 'salida', 'ajuste']),
  quantity: z.coerce.number().int().refine((v) => v !== 0, 'Cantidad no puede ser 0'),
  reason: optionalText,
  reference: optionalText,
});

export type PartMovementInput = z.infer<typeof partMovementSchema>;

export const usePartOnOrderSchema = z.object({
  part_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive('Cantidad > 0'),
  unit_sale_price: z.coerce.number().nonnegative(),
  notes: optionalText,
});

export type UsePartOnOrderInput = z.infer<typeof usePartOnOrderSchema>;
