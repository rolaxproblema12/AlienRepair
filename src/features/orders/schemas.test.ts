import { describe, expect, it } from 'vitest';
import {
  diagnosisSchema,
  intakeChecklistDataSchema,
  repairOrderSchema,
  sanitizeIntakeChecklist,
} from './schemas';

const validChecklistData = {
  bateria_porcentaje: 85,
  pantalla: 'ok',
  touch: 'ok',
  camara_trasera: 'ok',
  camara_frontal: 'ok',
  bocina: 'ok',
  microfono: 'ok',
  wifi: 'ok',
  bluetooth: 'ok',
  senal_celular: 'ok',
  carga: 'ok',
  bateria_estado: 'ok',
  botones_laterales: 'ok',
  estetica: 'ok',
  tapa_trasera: 'ok',
  trae_funda: false,
};

const baseRepairInput = {
  customer_id: '00000000-0000-0000-0000-000000000001',
  device_type: 'celular' as const,
  problem: 'No prende',
  cost: 1000,
  down_payment: 0,
  status: 'pendiente' as const,
  intake_checklist_applies: null,
  intake_checklist_reason: null,
  intake_checklist_reason_other: null,
  intake_checklist: null,
  warranty_void: false,
  warranty_void_reason: null,
};

describe('intakeChecklistDataSchema', () => {
  it('acepta data completa válida', () => {
    const r = intakeChecklistDataSchema.safeParse(validChecklistData);
    expect(r.success).toBe(true);
  });

  it('rechaza item con valor fuera del enum ok/falla/nc', () => {
    const r = intakeChecklistDataSchema.safeParse({
      ...validChecklistData,
      pantalla: 'bueno',
    });
    expect(r.success).toBe(false);
  });

  it('acepta batería null', () => {
    const r = intakeChecklistDataSchema.safeParse({
      ...validChecklistData,
      bateria_porcentaje: null,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza batería fuera de 0-100', () => {
    expect(
      intakeChecklistDataSchema.safeParse({ ...validChecklistData, bateria_porcentaje: -5 })
        .success,
    ).toBe(false);
    expect(
      intakeChecklistDataSchema.safeParse({ ...validChecklistData, bateria_porcentaje: 101 })
        .success,
    ).toBe(false);
  });

  it('coerce string numérico a número en batería', () => {
    const r = intakeChecklistDataSchema.safeParse({
      ...validChecklistData,
      bateria_porcentaje: '67',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.bateria_porcentaje).toBe(67);
  });

  it('rechaza si falta un item', () => {
    const { pantalla: _drop, ...incomplete } = validChecklistData;
    const r = intakeChecklistDataSchema.safeParse(incomplete);
    expect(r.success).toBe(false);
  });
});

describe('repairOrderSchema — intake checklist refinements', () => {
  it('acepta caso "sin definir" (todos null)', () => {
    expect(repairOrderSchema.safeParse(baseRepairInput).success).toBe(true);
  });

  it('acepta applies=true con checklist completo', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: true,
      intake_checklist: validChecklistData,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza applies=true sin checklist', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: true,
      intake_checklist: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.format())).toContain('Completa el checklist');
    }
  });

  it('acepta applies=false con razón válida', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: false,
      intake_checklist_reason: 'apagado',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza applies=false sin razón', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: false,
      intake_checklist_reason: null,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza applies=false con reason="otro" y reason_other vacío', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: false,
      intake_checklist_reason: 'otro',
      intake_checklist_reason_other: '   ',
    });
    expect(r.success).toBe(false);
  });

  it('acepta applies=false con reason="otro" y reason_other con texto', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      intake_checklist_applies: false,
      intake_checklist_reason: 'otro',
      intake_checklist_reason_other: 'cliente con prisa',
    });
    expect(r.success).toBe(true);
  });
});

describe('repairOrderSchema — otros refinements', () => {
  it('rechaza down_payment > cost', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      cost: 500,
      down_payment: 600,
    });
    expect(r.success).toBe(false);
  });

  it('acepta down_payment == cost (anticipo total)', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      cost: 500,
      down_payment: 500,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza warranty_void=true sin razón', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      warranty_void: true,
      warranty_void_reason: null,
    });
    expect(r.success).toBe(false);
  });

  it('acepta warranty_void=true con razón', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      warranty_void: true,
      warranty_void_reason: 'mojado',
    });
    expect(r.success).toBe(true);
  });

  it('coerce string numérico a número en cost/down_payment', () => {
    const r = repairOrderSchema.safeParse({
      ...baseRepairInput,
      cost: '1500',
      down_payment: '500',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cost).toBe(1500);
      expect(r.data.down_payment).toBe(500);
    }
  });

  it('rechaza customer_id que no es uuid', () => {
    const r = repairOrderSchema.safeParse({ ...baseRepairInput, customer_id: 'no-uuid' });
    expect(r.success).toBe(false);
  });

  it('rechaza problem demasiado corto', () => {
    const r = repairOrderSchema.safeParse({ ...baseRepairInput, problem: 'no' });
    expect(r.success).toBe(false);
  });
});

describe('sanitizeIntakeChecklist', () => {
  it('devuelve null para null/undefined', () => {
    expect(sanitizeIntakeChecklist(null)).toBeNull();
    expect(sanitizeIntakeChecklist(undefined)).toBeNull();
  });

  it('devuelve la data parseada para JSON válido', () => {
    const result = sanitizeIntakeChecklist(validChecklistData);
    expect(result).not.toBeNull();
    expect(result?.pantalla).toBe('ok');
  });

  it('degrada a null para JSON corrupto/parcial', () => {
    expect(sanitizeIntakeChecklist({ pantalla: 'ok' })).toBeNull();
    expect(sanitizeIntakeChecklist({ ...validChecklistData, pantalla: 'wrong' })).toBeNull();
    expect(sanitizeIntakeChecklist('not an object')).toBeNull();
    expect(sanitizeIntakeChecklist(42)).toBeNull();
  });
});

describe('diagnosisSchema', () => {
  it('rechaza diagnóstico vacío', () => {
    expect(diagnosisSchema.safeParse({ diagnosis: '' }).success).toBe(false);
    expect(diagnosisSchema.safeParse({ diagnosis: '  ' }).success).toBe(false);
  });

  it('rechaza diagnóstico < 3 chars', () => {
    expect(diagnosisSchema.safeParse({ diagnosis: 'ab' }).success).toBe(false);
  });

  it('acepta diagnóstico válido', () => {
    expect(diagnosisSchema.safeParse({ diagnosis: 'Pantalla rota' }).success).toBe(true);
  });

  it('trim antes de validar', () => {
    const r = diagnosisSchema.safeParse({ diagnosis: '   abc   ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.diagnosis).toBe('abc');
  });
});
