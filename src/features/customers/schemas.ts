import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  phone: z
    .string()
    .trim()
    .min(7, 'Teléfono inválido')
    .regex(/^[+\d\s()-]+$/, 'Solo dígitos y +()-'),
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
