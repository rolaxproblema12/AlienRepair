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

const itemStatusSchema = z.enum(['ok', 'falla', 'nc']);

const batteryPercentSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'string' ? parseInt(v, 10) : v;
    return Number.isFinite(n) ? n : null;
  })
  .pipe(
    z
      .number()
      .int()
      .min(0, '0–100')
      .max(100, '0–100')
      .nullable(),
  );

export const intakeChecklistDataSchema = z.object({
  bateria_porcentaje: batteryPercentSchema,
  pantalla: itemStatusSchema,
  touch: itemStatusSchema,
  camara_trasera: itemStatusSchema,
  camara_frontal: itemStatusSchema,
  bocina: itemStatusSchema,
  microfono: itemStatusSchema,
  wifi: itemStatusSchema,
  bluetooth: itemStatusSchema,
  senal_celular: itemStatusSchema,
  carga: itemStatusSchema,
  bateria_estado: itemStatusSchema,
  botones_laterales: itemStatusSchema,
  estetica: itemStatusSchema,
  tapa_trasera: itemStatusSchema,
  trae_funda: z.boolean(),
});

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
    diagnosis: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === '' ? null : v)),
    status: z
      .enum(['pendiente', 'diagnostico', 'en_espera', 'reparando', 'listo', 'entregado'])
      .default('pendiente'),
    /** Si esta OS es reclamo de garantía de otra (id de la OS original). */
    warranty_claim_of: z.string().uuid().optional().nullable(),
    intake_checklist_applies: z.boolean().nullable().default(null),
    intake_checklist_reason: z
      .enum(['apagado', 'mojado', 'sin_codigo', 'otro'])
      .nullable()
      .default(null),
    intake_checklist_reason_other: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === '' ? null : v)),
    intake_checklist: intakeChecklistDataSchema.nullable().default(null),
    warranty_void: z.boolean().default(false),
    warranty_void_reason: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v === '' ? null : v)),
  })
  .refine((d) => d.down_payment <= d.cost, {
    message: 'El anticipo no puede ser mayor al costo',
    path: ['down_payment'],
  })
  .refine(
    (d) =>
      d.intake_checklist_applies !== true || d.intake_checklist !== null,
    {
      message: 'Completa el checklist de ingreso',
      path: ['intake_checklist'],
    },
  )
  .refine(
    (d) =>
      d.intake_checklist_applies !== false || d.intake_checklist_reason !== null,
    {
      message: 'Selecciona la razón por la que no aplica',
      path: ['intake_checklist_reason'],
    },
  )
  .refine(
    (d) =>
      d.intake_checklist_reason !== 'otro' ||
      (d.intake_checklist_reason_other ?? '').trim().length > 0,
    {
      message: 'Describe la razón',
      path: ['intake_checklist_reason_other'],
    },
  )
  .refine(
    (d) => !d.warranty_void || (d.warranty_void_reason ?? '').trim().length > 0,
    {
      message: 'Indica la razón por la que no aplica garantía',
      path: ['warranty_void_reason'],
    },
  );

export type RepairOrderInput = z.infer<typeof repairOrderSchema>;

export const diagnosisSchema = z.object({
  diagnosis: z.string().trim().min(3, 'Describe el diagnóstico'),
});
export type DiagnosisInput = z.infer<typeof diagnosisSchema>;
