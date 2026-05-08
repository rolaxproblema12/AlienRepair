import { describe, expect, it } from 'vitest';
import {
  buildDiagnosisMessage,
  buildStatusMessage,
  formatPhoneDisplay,
  normalizePhone,
} from './whatsapp';

describe('normalizePhone', () => {
  it('devuelve string vacío para input vacío', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });

  it('agrega prefijo MX a 10 dígitos sin prefijo', () => {
    expect(normalizePhone('5551234567')).toBe('525551234567');
  });

  it('respeta prefijo 52 ya presente', () => {
    expect(normalizePhone('525551234567')).toBe('525551234567');
  });

  it('respeta prefijo 1 (US) ya presente', () => {
    expect(normalizePhone('15551234567')).toBe('15551234567');
  });

  it('quita caracteres no numéricos', () => {
    expect(normalizePhone('+52 (555) 123-4567')).toBe('525551234567');
    expect(normalizePhone('555.123.4567')).toBe('525551234567');
  });

  it('mantiene números más largos sin tocar prefijo', () => {
    // > 10 dígitos asumimos que ya viene completo.
    expect(normalizePhone('5215551234567')).toBe('5215551234567');
  });
});

describe('formatPhoneDisplay', () => {
  it('devuelve cadena vacía para null/undefined/empty', () => {
    expect(formatPhoneDisplay(null)).toBe('');
    expect(formatPhoneDisplay(undefined)).toBe('');
    expect(formatPhoneDisplay('')).toBe('');
  });

  it('formatea 12 dígitos con prefijo 52', () => {
    expect(formatPhoneDisplay('525551234567')).toBe('+52 555 123 4567');
  });

  it('formatea 10 dígitos sin prefijo', () => {
    expect(formatPhoneDisplay('5551234567')).toBe('555 123 4567');
  });

  it('passthrough para formatos no reconocidos', () => {
    expect(formatPhoneDisplay('+1 800-555-0100')).toBe('+1 800-555-0100');
  });
});

describe('buildStatusMessage', () => {
  it('usa default template cuando no se pasa custom', () => {
    const msg = buildStatusMessage('Juan', 'CM-0042', 'listo');
    expect(msg).toContain('Hola Juan');
    expect(msg).toContain('CM-0042');
    expect(msg).toContain('listo para recoger');
  });

  it('usa shopName custom en lugar de AlienTechnology', () => {
    const msg = buildStatusMessage('Juan', 'CM-0042', 'pendiente', {
      shopName: 'MiShop',
    });
    expect(msg).toContain('te escribimos de MiShop');
    expect(msg).not.toContain('AlienTechnology');
  });

  it('cae a "AlienTechnology" cuando shopName es vacío', () => {
    const msg = buildStatusMessage('Juan', 'F1', 'listo', { shopName: '   ' });
    expect(msg).toContain('AlienTechnology');
  });

  it('plantilla custom reemplaza completamente el mensaje base', () => {
    const msg = buildStatusMessage('Ana', 'CM-001', 'reparando', {
      template: 'Hola {customer}, OS {folio} en proceso.',
    });
    expect(msg).toBe('Hola Ana, OS CM-001 en proceso.');
  });

  it('expande {customer} y {folio} múltiples veces', () => {
    const msg = buildStatusMessage('Ana', 'CM-001', 'listo', {
      template: '{customer} y otra vez {customer} ({folio} / {folio})',
    });
    expect(msg).toBe('Ana y otra vez Ana (CM-001 / CM-001)');
  });

  it('anexa extra al final con doble salto', () => {
    const msg = buildStatusMessage('Juan', 'F1', 'listo', {
      extra: 'Link: http://pago.com',
    });
    expect(msg).toMatch(/\n\nLink: http:\/\/pago\.com$/);
  });

  it('compat hacia atrás: string como cuarto arg se trata como extra', () => {
    const msg = buildStatusMessage('Juan', 'F1', 'listo', 'Pago aquí');
    expect(msg).toMatch(/\n\nPago aquí$/);
  });

  it('status desconocido devuelve solo el saludo base', () => {
    const msg = buildStatusMessage('Juan', 'F1', 'estado_inventado');
    expect(msg).toContain('Hola Juan');
    expect(msg).toContain('orden #F1');
  });
});

describe('buildDiagnosisMessage', () => {
  it('usa default template y expande las 3 variables', () => {
    const msg = buildDiagnosisMessage('Juan', 'CM-0042', 'Pantalla rota, $850');
    expect(msg).toContain('Hola Juan');
    expect(msg).toContain('OS #CM-0042');
    expect(msg).toContain('Pantalla rota, $850');
  });

  it('plantilla custom reemplaza el default', () => {
    const msg = buildDiagnosisMessage('Ana', 'F1', 'No prende', {
      template: '{customer}: {diagnosis} ({folio})',
    });
    expect(msg).toBe('Ana: No prende (F1)');
  });

  it('plantilla vacía cae al default', () => {
    const msg = buildDiagnosisMessage('Ana', 'F1', 'X', { template: '   ' });
    expect(msg).toContain('te compartimos el diagnóstico');
  });
});
