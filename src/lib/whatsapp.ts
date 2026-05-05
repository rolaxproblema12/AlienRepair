const DEFAULT_COUNTRY_PREFIX = '52'; // México

export function normalizePhone(input: string): string {
  const digits = (input ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('52') || digits.startsWith('1') || digits.length > 10) return digits;
  return `${DEFAULT_COUNTRY_PREFIX}${digits}`;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('52') && d.length === 12) {
    const n = d.slice(2);
    return `+52 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  if (d.length === 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return phone;
}

export async function openWhatsApp(phone: string, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error('Teléfono inválido');
  await window.alien.openWhatsApp(normalized, message);
}

export interface BuildStatusMessageOpts {
  /** Nombre comercial del shop (default 'AlienTechnology' como legacy fallback). */
  shopName?: string | null;
  /**
   * Plantilla custom por status configurada en /admin/configuracion. Si está
   * presente reemplaza el mensaje hardcoded; si no, se usa el default histórico.
   * Soporta `{customer}` y `{folio}` como variables.
   */
  template?: string | null;
  /** Texto extra a anexar al final con doble salto (ej: link de pago). */
  extra?: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  pendiente: 'Recibimos tu equipo y pronto iniciaremos el diagnóstico.',
  diagnostico: 'Ya hicimos el diagnóstico de tu equipo. Te lo compartimos por aparte.',
  en_espera: 'Tu equipo está en espera (pendiente de refacción o confirmación).',
  reparando: 'Ya comenzamos la reparación de tu equipo.',
  listo: '¡Tu equipo ya está listo para recoger! 🎉',
  entregado: 'Gracias por tu confianza. Cualquier duda avísanos.',
};

const DEFAULT_DIAGNOSIS_TEMPLATE =
  'Hola {customer}, te compartimos el diagnóstico de tu equipo (OS #{folio}):\n\n{diagnosis}\n\nQuedamos atentos a tu autorización para continuar con la reparación.';

function applyVars(template: string, customer: string, folio: string): string {
  return template.replaceAll('{customer}', customer).replaceAll('{folio}', folio);
}

export function buildStatusMessage(
  customerName: string,
  folio: string,
  status: string,
  optsOrExtra?: BuildStatusMessageOpts | string,
): string {
  // Backwards compat: si el caller pasa un string, es el `extra` legacy.
  const opts: BuildStatusMessageOpts =
    typeof optsOrExtra === 'string'
      ? { extra: optsOrExtra }
      : (optsOrExtra ?? {});

  const shopName = opts.shopName?.trim() || 'AlienTechnology';
  const base = `Hola ${customerName}, te escribimos de ${shopName} sobre tu orden #${folio}.`;

  // Si hay template custom, esa es la totalidad del mensaje (con vars
  // expandidas). Si no, base + body por status del map default.
  let text: string;
  if (opts.template && opts.template.trim()) {
    text = applyVars(opts.template.trim(), customerName, folio);
  } else {
    const body = DEFAULT_TEMPLATES[status];
    text = body ? `${base} ${body}` : base;
  }

  return opts.extra ? `${text}\n\n${opts.extra}` : text;
}

export interface BuildDiagnosisMessageOpts {
  shopName?: string | null;
  /** Plantilla custom configurada por sucursal en `sucursal_settings.msg_diagnosis`. Soporta `{customer}`, `{folio}`, `{diagnosis}`. */
  template?: string | null;
}

export function buildDiagnosisMessage(
  customerName: string,
  folio: string,
  diagnosis: string,
  opts?: BuildDiagnosisMessageOpts,
): string {
  const tpl = opts?.template?.trim() || DEFAULT_DIAGNOSIS_TEMPLATE;
  return tpl
    .replaceAll('{customer}', customerName)
    .replaceAll('{folio}', folio)
    .replaceAll('{diagnosis}', diagnosis);
}
