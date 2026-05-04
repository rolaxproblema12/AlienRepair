import { z } from 'zod';

export const sucursalSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,4}$/, 'Código: 2-4 caracteres, solo letras mayúsculas y dígitos'),
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  address: z
    .string()
    .trim()
    .max(200, 'Máximo 200 caracteres')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v == null ? null : v)),
  phone: z
    .string()
    .trim()
    .max(40, 'Máximo 40 caracteres')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v == null ? null : v)),
  active: z.boolean().default(true),
});

export type SucursalInput = z.infer<typeof sucursalSchema>;
