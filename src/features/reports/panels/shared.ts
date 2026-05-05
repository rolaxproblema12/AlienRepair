/**
 * Helpers de fecha compartidos por los panels de reportes.
 * Devuelven fechas en formato YYYY-MM-DD (input type=date).
 */

export function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
