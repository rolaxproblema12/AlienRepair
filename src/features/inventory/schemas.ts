import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(200),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU requerido')
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, 'Solo letras, números y . _ -'),
  barcode: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  category_id: z.string().uuid('Selecciona una categoría'),
  brand: optionalText,
  model: optionalText,
  supplier: optionalText,
  description: optionalText,
  notes: optionalText,
  cost_price: z.coerce.number().nonnegative('Debe ser ≥ 0'),
  sale_price: z.coerce.number().nonnegative('Debe ser ≥ 0'),
  iva_rate: z.coerce.number().min(0).max(1).default(0.16),
  min_stock: z
    .union([z.coerce.number().int().nonnegative(), z.literal('').transform(() => null)])
    .nullable()
    .optional(),
  initial_stock: z.coerce.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(80),
  color: z
    .string()
    .trim()
    .max(40)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const movementSchema = z.object({
  kind: z.enum(['entrada', 'salida', 'ajuste']),
  quantity: z.coerce.number().int().refine((v) => v !== 0, 'Cantidad no puede ser 0'),
  reason: optionalText,
  reference: optionalText,
});

export type MovementInput = z.infer<typeof movementSchema>;
