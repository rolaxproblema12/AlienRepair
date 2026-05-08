import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useImportProductsCsv, type CsvProductRow } from './hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { log } from '@/lib/logger';

const REQUIRED_COLS = ['sku', 'name', 'category', 'cost_price', 'sale_price'];
const ALL_COLS = [
  'sku',
  'name',
  'category',
  'cost_price',
  'sale_price',
  'iva_rate',
  'barcode',
  'brand',
  'model',
  'supplier',
  'min_stock',
  'initial_stock',
  'notes',
];

interface ParsedRow {
  raw: Record<string, string>;
  data?: CsvProductRow;
  errors: string[];
}

function parseCsv(text: string): { rows: ParsedRow[]; headerErrors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { rows: [], headerErrors: ['Archivo vacío.'] };

  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const headerErrors: string[] = [];
  for (const c of REQUIRED_COLS) {
    if (!header.includes(c)) {
      headerErrors.push(`Falta columna obligatoria: ${c}`);
    }
  }
  if (headerErrors.length) return { rows: [], headerErrors };

  const rows: ParsedRow[] = lines.slice(1).map((line) => {
    const values = splitLine(line);
    const raw: Record<string, string> = {};
    header.forEach((h, i) => (raw[h] = (values[i] ?? '').trim()));
    const errors: string[] = [];
    for (const c of REQUIRED_COLS) {
      if (!raw[c]) errors.push(`${c} requerido`);
    }
    const cost = Number(raw.cost_price);
    const sale = Number(raw.sale_price);
    if (raw.cost_price && Number.isNaN(cost)) errors.push('cost_price no es número');
    if (raw.sale_price && Number.isNaN(sale)) errors.push('sale_price no es número');
    if (cost < 0) errors.push('cost_price < 0');
    if (sale < 0) errors.push('sale_price < 0');

    if (errors.length) return { raw, errors };

    const data: CsvProductRow = {
      sku: raw.sku,
      name: raw.name,
      category: raw.category,
      cost_price: cost,
      sale_price: sale,
      iva_rate: raw.iva_rate ? Number(raw.iva_rate) : undefined,
      barcode: raw.barcode || null,
      brand: raw.brand || null,
      model: raw.model || null,
      supplier: raw.supplier || null,
      min_stock: raw.min_stock ? Number(raw.min_stock) : null,
      initial_stock: raw.initial_stock ? Number(raw.initial_stock) : 0,
      notes: raw.notes || null,
    };
    return { raw, data, errors: [] };
  });

  return { rows, headerErrors: [] };
}

function splitLine(line: string): string[] {
  // Soporte básico de CSV con comillas dobles
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export default function InventoryImportPage() {
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const importMut = useImportProductsCsv();

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      const result = parseCsv(text);
      setHeaderErrors(result.headerErrors);
      setParsed(result.rows);
    };
    reader.onerror = () => {
      log.error('inventory', 'FileReader error en import CSV', reader.error);
      toast.error('No se pudo leer el archivo. ¿Está corrupto?');
      setFileName(null);
    };
    reader.readAsText(file, 'UTF-8');
  }

  const validRows = parsed.filter((r) => r.errors.length === 0).map((r) => r.data!);
  const invalidCount = parsed.length - validRows.length;

  async function handleImport() {
    if (!validRows.length) {
      toast.error('No hay filas válidas para importar.');
      return;
    }
    try {
      const result = await importMut.mutateAsync(validRows);
      if (result.errors.length > 0) {
        const detail = result.errors
          .slice(0, 3)
          .map((e) => `fila ${e.row} (${e.sku})`)
          .join(', ');
        toast.warning(
          `Importadas ${result.created} de ${validRows.length}. ${result.errors.length} errores: ${detail}${result.errors.length > 3 ? '…' : ''}`,
          { duration: 8000 },
        );
      } else {
        toast.success(`Importadas ${result.created} de ${validRows.length}.`);
      }
      setParsed([]);
      setFileName(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/inventario">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar inventario</h1>
          <p className="text-sm text-muted-foreground">
            Sube un archivo .csv con los productos del local.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formato del archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Encabezado en la primera línea, separador coma. Columnas obligatorias en{' '}
            <strong>negritas</strong>. Las categorías se crean automáticamente si no
            existen.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {ALL_COLS.map((c) =>
              REQUIRED_COLS.includes(c) ? c.toUpperCase() : c,
            ).join(',')}
          </pre>
          <p className="text-xs text-muted-foreground">
            <strong>iva_rate</strong> en decimal (0.16 = 16%). <strong>initial_stock</strong>{' '}
            crea un movimiento de entrada con motivo "Stock inicial".
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border p-8 text-center hover:border-primary/40">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {fileName ?? 'Selecciona o arrastra un archivo .csv'}
              </p>
              <p className="text-xs text-muted-foreground">UTF-8, encabezado en línea 1</p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {headerErrors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Errores en el encabezado</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
              {headerErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {parsed.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Vista previa</CardTitle>
              <p className="text-xs text-muted-foreground">
                {validRows.length} válidas · {invalidCount} con error
              </p>
            </div>
            <Button
              onClick={handleImport}
              disabled={importMut.isPending || !validRows.length}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {importMut.isPending
                ? 'Importando...'
                : `Importar ${validRows.length} válidas`}
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead className="text-right">Stock inicial</TableHead>
                  <TableHead className="pr-6">Errores</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((r, i) => (
                  <TableRow
                    key={i}
                    className={cn(r.errors.length > 0 && 'bg-destructive/5')}
                  >
                    <TableCell className="pl-6 font-mono text-xs">
                      {r.raw.sku}
                    </TableCell>
                    <TableCell className="text-sm">{r.raw.name}</TableCell>
                    <TableCell className="text-sm">{r.raw.category}</TableCell>
                    <TableCell className="text-right text-sm">{r.raw.cost_price}</TableCell>
                    <TableCell className="text-right text-sm">{r.raw.sale_price}</TableCell>
                    <TableCell className="text-right text-sm">
                      {r.raw.initial_stock || '—'}
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-destructive">
                      {r.errors.join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
