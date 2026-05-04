import { formatDistanceToNow, isBefore, parseISO, startOfDay } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

export const TZ = 'America/Mexico_City';

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, "d 'de' MMMM yyyy, HH:mm", { locale: es });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, "d 'de' MMMM yyyy", { locale: es });
}

export function formatShortDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatInTimeZone(date, TZ, 'dd/MM/yyyy', { locale: es });
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatDistanceToNow(toZonedTime(date, TZ), { addSuffix: true, locale: es });
}

export function formatRelativeShort(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'ahora';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 172_800_000) return 'ayer';
  if (diff < 604_800_000) return `hace ${Math.floor(diff / 86_400_000)} d`;
  return formatInTimeZone(date, TZ, 'dd MMM', { locale: es });
}

export function isOverdue(estimated: string | null | undefined): boolean {
  if (!estimated) return false;
  return isBefore(parseISO(estimated), startOfDay(new Date()));
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
