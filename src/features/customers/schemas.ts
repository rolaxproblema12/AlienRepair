import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  phone: z
    .string()
    .trim()
    .min(7, 'Teléfono inválido (mínimo 7 dígitos)')
    .regex(
      /^[+\d\s()-]+$/,
      'Formato inválido. Usá dígitos, opcionalmente +, espacios, ( ) o -. Ej: +52 55 1234 5678',
    ),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  notes: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
