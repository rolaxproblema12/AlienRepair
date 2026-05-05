import { z } from 'zod';

const numericMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? parseFloat(v || '0') : v))
  .pipe(
    z
      .number()
      .min(0, 'Debe ser >= 0')
      .refine((n) => Number.isFinite(n), 'Debe ser un número válido'),
  );

export const repairOrderSchema = z
  .object({
    customer_id: z.string().uuid('Selecciona un cliente'),
    device_type: z.enum([
      'celular',
      'tablet',
      'computadora',
      'bocina',
      'tv',
      'consola',
      'otro',
    ]),
    brand: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    color: z.string().trim().optional().nullable(),
    device_password: z.string().optional().nullable(),
    problem: z.string().trim().min(3, 'Describe el problema'),
    cost: numericMoney,
    down_payment: numericMoney,
    estimated_delivery: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === '' ? null : v)),
    notes: z.string().optional().nullable(),
    status: z
      .enum(['pendiente', 'en_espera', 'reparando', 'listo', 'entregado'])
      .default('pendiente'),
    /** Si esta OS es reclamo de garantía de otra (id de la OS original). */
    warranty_claim_of: z.string().uuid().optional().nullable(),
  })
  .refine((d) => d.down_payment <= d.cost, {
    message: 'El anticipo no puede ser mayor al costo',
    path: ['down_payment'],
  });

export type RepairOrderInput = z.infer<typeof repairOrderSchema>;
