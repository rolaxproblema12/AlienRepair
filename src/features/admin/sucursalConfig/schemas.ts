import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v == null ? null : v));

// Schema de "configuración del shop" (extiende sucursalSchema con los
// campos de branding/tickets agregados en migración 0033).
export const sucursalConfigSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  address: optionalText(200),
  phone: optionalText(40),
  rfc: optionalText(40),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(120)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v == null ? null : v)),
  web: optionalText(200),
  logo_url: z
    .string()
    .trim()
    .url('Debe ser una URL https://...')
    .max(400)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v == null ? null : v)),
  warranty_message: optionalText(500),
  warranty_days: z.coerce
    .number()
    .int()
    .min(0, 'Mínimo 0')
    .max(730, 'Máximo 730 (2 años)')
    .default(30),
});

export type SucursalConfigInput = z.infer<typeof sucursalConfigSchema>;

// Plantillas WhatsApp por status. Las keys siguen el patrón
// `msg_status_<order_status>` para que sea trivial mapearlas.
export const ORDER_STATUS_KEYS = [
  'pendiente',
  'en_espera',
  'reparando',
  'listo',
  'entregado',
] as const;

export type OrderStatusKey = (typeof ORDER_STATUS_KEYS)[number];

export const STATUS_TEMPLATE_LABELS: Record<OrderStatusKey, string> = {
  pendiente: 'Recibido / Pendiente',
  en_espera: 'En espera',
  reparando: 'En reparación',
  listo: 'Listo para recoger',
  entregado: 'Entregado',
};

export const whatsappTemplatesSchema = z.object({
  pendiente: z.string().max(500).optional(),
  en_espera: z.string().max(500).optional(),
  reparando: z.string().max(500).optional(),
  listo: z.string().max(500).optional(),
  entregado: z.string().max(500).optional(),
});

export type WhatsappTemplatesInput = z.infer<typeof whatsappTemplatesSchema>;
