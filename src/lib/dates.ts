import { format, formatDistanceToNow, isBefore, startOfDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export const TZ = 'America/Mexico_City';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(d: string | Date | null | undefined): d is string {
  return typeof d === 'string' && DATE_ONLY_RE.test(d);
}

function dateOnlyToLocal(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  if (typeof d !== 'string') return d;
  if (DATE_ONLY_RE.test(d)) return dateOnlyToLocal(d);
  return new Date(d);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (isDateOnly(d)) {
    // String DATE-only: no tiene hora real, no inventes "00:00".
    return format(dateOnlyToLocal(d), "d 'de' MMMM yyyy", { locale: es });
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, "d 'de' MMMM yyyy, HH:mm", { locale: es });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (isDateOnly(d)) {
    return format(dateOnlyToLocal(d), "d 'de' MMMM yyyy", { locale: es });
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, "d 'de' MMMM yyyy", { locale: es });
}

export function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (isDateOnly(d)) {
    return format(dateOnlyToLocal(d), 'dd/MM/yyyy', { locale: es });
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, 'dd/MM/yyyy', { locale: es });
}

export function relativeTime(d: string | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return '';
  return formatDistanceToNow(toZonedTime(date, TZ), { addSuffix: true, locale: es });
}

export function formatRelativeShort(d: string | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 172_800_000) return 'ayer';
  if (diff < 604_800_000) return `hace ${Math.floor(diff / 86_400_000)} d`;
  if (isDateOnly(d)) {
    return format(date, 'dd MMM', { locale: es });
  }
  return formatInTimeZone(date, TZ, 'dd MMM', { locale: es });
}

export function isOverdue(estimated: string | null | undefined): boolean {
  const date = toDate(estimated);
  if (!date) return false;
  return isBefore(startOfDay(date), startOfDay(new Date()));
}

export function todayIso(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
}

export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd');
}

export function firstOfMonthIso(): string {
  return formatInTimeZone(new Date(), TZ, 'yyyy-MM-01');
}
