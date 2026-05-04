import { z } from 'zod';

const numericMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'string' ? parseFloat(v || '0') : v))
  .pipe(z.number().min(0, 'Debe ser >= 0'));

export const expenseSchema = z
  .object({
    kind: z.enum(['refaccion', 'general']),
    order_id: z.string().uuid().optional().nullable(),
    description: z.string().trim().min(3, 'Describe el gasto'),
    amount: numericMoney,
    spent_at: z.string().min(1, 'Selecciona una fecha'),
    notes: z.string().optional().nullable(),
  })
  .refine((d) => d.kind !== 'refaccion' || !!d.order_id, {
    message: 'Selecciona la orden asociada',
    path: ['order_id'],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
