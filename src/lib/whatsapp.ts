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

export function buildStatusMessage(
  customerName: string,
  folio: string,
  status: string,
  extra?: string
): string {
  const base = `Hola ${customerName}, te escribimos de AlienTechnology sobre tu orden #${folio}.`;
  const map: Record<string, string> = {
    pendiente: `${base} Recibimos tu equipo y pronto iniciaremos el diagnóstico.`,
    en_espera: `${base} Tu equipo está en espera (pendiente de refacción o confirmación).`,
    reparando: `${base} Ya comenzamos la reparación de tu equipo.`,
    listo: `${base} ¡Tu equipo ya está listo para recoger! 🎉`,
    entregado: `${base} Gracias por tu confianza. Cualquier duda avísanos.`,
  };
  const text = map[status] ?? base;
  return extra ? `${text}\n\n${extra}` : text;
}
