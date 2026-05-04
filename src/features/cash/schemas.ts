import { z } from 'zod';

export const openSessionSchema = z.object({
  opening_amount: z.coerce.number().nonnegative('Debe ser ≥ 0'),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;

export const closeSessionSchema = z.object({
  counted_cash: z.coerce.number().nonnegative('Debe ser ≥ 0'),
  closing_notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export type CloseSessionInput = z.infer<typeof closeSessionSchema>;

export const orderPaymentSchema = z.object({
  amount: z.coerce.number().positive('Monto > 0'),
  payment_method: z.enum(['efectivo', 'tarjeta', 'transferencia']),
  notes: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
});

export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;
