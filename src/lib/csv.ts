/**
 * Helper minimalista de CSV. Sin librería externa — el formato CSV en
 * realidad es trivial; jsPDF/PapaParse son overkill para nuestros
 * exports.
 *
 * Uso:
 *   const csv = generateCsvContent(rows, [
 *     { key: 'dia', label: 'Día' },
 *     { key: 'total', label: 'Total' },
 *   ]);
 *   downloadCsv('ventas-2026-05', csv);
 *
 * El BOM (U+FEFF) al inicio del Blob fuerza a Excel a abrir como UTF-8
 * — sin él los caracteres con tilde y eñe aparecen como mojibake en
 * Excel ES.
 */

const UTF8_BOM = '﻿';

export interface CsvHeader<T> {
  key: keyof T;
  label: string;
}

export function generateCsvContent<T extends Record<string, unknown>>(
  rows: T[],
  headers: CsvHeader<T>[],
): string {
  const headerRow = headers.map((h) => csvEscape(h.label)).join(',');
  const dataRows = rows.map((row) =>
    headers.map((h) => csvEscape(stringifyCell(row[h.key]))).join(','),
  );
  return [headerRow, ...dataRows].join('\n');
}

function stringifyCell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  return String(v);
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([UTF8_BOM + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
