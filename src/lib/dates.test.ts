import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatShortDate,
  formatRelativeShort,
  isOverdue,
  todayIso,
  isoDaysAgo,
  firstOfMonthIso,
  TZ,
} from './dates';

describe('TZ', () => {
  it('uses Mexico City timezone', () => {
    expect(TZ).toBe('America/Mexico_City');
  });
});

describe('formatDate', () => {
  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formats ISO string in es-MX with Mexico City TZ', () => {
    expect(formatDate('2026-05-03T18:00:00Z')).toMatch(/3 de mayo 2026/);
  });

  it('preserves the day for DATE-only strings (no UTC shift)', () => {
    // Regression: `new Date("2026-05-07")` se interpretaba como UTC midnight y
    // formatInTimeZone con America/Mexico_City lo desplazaba al día anterior.
    expect(formatDate('2026-05-07')).toBe('7 de mayo 2026');
    expect(formatDate('2026-01-01')).toBe('1 de enero 2026');
    expect(formatDate('2026-12-31')).toBe('31 de diciembre 2026');
  });

  it('formatDateTime con DATE-only no inventa hora 00:00', () => {
    expect(formatDateTime('2026-05-07')).toBe('7 de mayo 2026');
  });
});

describe('formatDateTime', () => {
  it('returns em-dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('includes hours', () => {
    expect(formatDateTime('2026-05-03T18:00:00Z')).toMatch(/2026, \d{2}:\d{2}/);
  });
});

describe('formatShortDate', () => {
  it('returns dd/MM/yyyy', () => {
    expect(formatShortDate('2026-05-03T18:00:00Z')).toMatch(/^\d{2}\/05\/2026$/);
  });

  it('returns em-dash for null', () => {
    expect(formatShortDate(null)).toBe('—');
  });

  it('preserves day for DATE-only strings', () => {
    expect(formatShortDate('2026-05-07')).toBe('07/05/2026');
  });
});

describe('formatRelativeShort', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns "ahora" for very recent', () => {
    expect(formatRelativeShort(new Date('2026-05-03T11:59:30Z'))).toBe('ahora');
  });

  it('returns minutes for recent', () => {
    expect(formatRelativeShort(new Date('2026-05-03T11:55:00Z'))).toBe('hace 5 min');
  });

  it('returns hours within the same day', () => {
    expect(formatRelativeShort(new Date('2026-05-03T09:00:00Z'))).toBe('hace 3 h');
  });

  it('returns "ayer" for ~1 day ago', () => {
    expect(formatRelativeShort(new Date('2026-05-02T11:59:00Z'))).toBe('ayer');
  });

  it('returns days for several days ago', () => {
    expect(formatRelativeShort(new Date('2026-04-30T12:00:00Z'))).toBe('hace 3 d');
  });

  it('returns short month/day for week-old dates', () => {
    expect(formatRelativeShort(new Date('2026-04-10T12:00:00Z'))).toMatch(/\d+ \w+/);
  });

  it('returns empty string for null', () => {
    expect(formatRelativeShort(null)).toBe('');
  });
});

describe('isOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false);
  });

  it('returns true for past dates', () => {
    expect(isOverdue('2026-05-01')).toBe(true);
  });

  it('returns false for future dates', () => {
    expect(isOverdue('2026-05-10')).toBe(false);
  });
});

describe('iso helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T18:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('todayIso returns yyyy-MM-dd in Mexico City TZ', () => {
    expect(todayIso()).toBe('2026-05-03');
  });

  it('isoDaysAgo returns date N days back', () => {
    expect(isoDaysAgo(7)).toBe('2026-04-26');
  });

  it('firstOfMonthIso returns first of current month', () => {
    expect(firstOfMonthIso()).toBe('2026-05-01');
  });
});
