import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDeletePart, usePartBrands, useParts } from './hooks';
import {
  PART_CATEGORIES,
  PART_CATEGORY_COLOR,
  PART_CATEGORY_LABELS,
  isPartLowStock,
  partMarginPct,
  type Part,
  type PartCategory,
} from './types';
import PartMovementDialog from './PartMovementDialog';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import { getErrorMessage } from '@/lib/errors';
import { useCanSeeCosts } from '@/lib/costVisibilityStore';

const ROW_LIMIT = 20;

export default function PartsListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = useState<PartCategory | 'all'>('all');
  const [brand, setBrand] = useState<string | 'all'>('all');
  const [lowStock, setLowStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Part | null>(null);

  const partsQ = useParts({
    search: debouncedSearch,
    category,
    brand,
    lowStock,
    includeInactive,
  });
  const brandsQ = usePartBrands();
  const del = useDeletePart();
  const costs = useCanSeeCosts();

  const isFiltering =
    debouncedSearch.trim().length > 0 ||
    category !== 'all' ||
    brand !== 'all' ||
    lowStock ||
    includeInactive;

  useEffect(() => {
    if (isFiltering && expanded) setExpanded(false);
  }, [isFiltering, expanded]);

  const total = partsQ.data?.length ?? 0;
  const lowStockCount = useMemo(
    () => (partsQ.data ?? []).filter(isPartLowStock).length,
    [partsQ.data],
  );
  const collapsed = !isFiltering && !expanded && total > ROW_LIMIT;
  const visible = collapsed ? partsQ.data!.slice(0, ROW_LIMIT) : partsQ.data ?? [];
  const hidden = total - visible.length;

  async function handleDelete(p: Part) {
    try {
      await del.mutateAsync(p.id);
      toast.success(`Pieza "${p.name}" desactivada`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Piezas</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'pieza' : 'piezas'}
            {lowStockCount > 0 && (
              <>
                {' · '}
                <span className="text-destructive">{lowStockCount} en stock bajo</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {costs.isAdmin && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={costs.toggle}
              title={costs.hidden ? 'Mostrar costos' : 'Ocultar costos'}
            >
              {costs.hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button asChild>
            <Link to="/piezas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva pieza
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, marca, modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={category}
          onValueChange={(v) => setCategory(v as PartCategory | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {PART_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {PART_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={brand} onValueChange={(v) => setBrand(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {(brandsQ.data ?? []).map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setLowStock((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition',
            lowStock
              ? 'border-destructive bg-destructive/10 text-destructive'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Stock bajo
        </button>

        <button
          type="button"
          onClick={() => setIncludeInactive((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition',
            includeInactive
              ? 'border-primary bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          Incluir inactivas
        </button>
      </div>

      <Card>
        {partsQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Cpu className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isFiltering
                ? 'Sin coincidencias con esos filtros.'
                : 'Aún no hay piezas registradas.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pieza</TableHead>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                {costs.canSee && <TableHead className="text-right">Compra</TableHead>}
                <TableHead className="text-right">
                  {costs.canSee ? 'Venta' : 'Precio'}
                </TableHead>
                {costs.canSee && <TableHead className="text-right">Margen</TableHead>}
                <TableHead className="w-[140px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => {
                const low = isPartLowStock(p);
                const margin = partMarginPct(p);
                return (
                  <TableRow key={p.id} className={!p.active ? 'opacity-60' : ''}>
                    <TableCell>
                      <Link
                        to={`/piezas/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.brand} · {p.model}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-white',
                          PART_CATEGORY_COLOR[p.category],
                        )}
                      >
                        {PART_CATEGORY_LABELS[p.category]}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-sm',
                        low && 'font-semibold text-destructive',
                      )}
                    >
                      {p.stock}
                      {p.min_stock != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          / {p.min_stock}
                        </span>
                      )}
                    </TableCell>
                    {costs.canSee && (
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {currency(p.cost_purchase)}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm font-medium">
                      {currency(p.cost_sale)}
                    </TableCell>
                    {costs.canSee && (
                      <TableCell className="text-right text-sm">
                        {margin.toFixed(1)}%
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Registrar movimiento"
                          onClick={() => setMoveTarget(p)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button asChild variant="ghost" size="icon" title="Editar">
                          <Link to={`/piezas/${p.id}/editar`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton
                          onConfirm={() => handleDelete(p)}
                          description={
                            <>
                              Se desactivará la pieza <strong>{p.name}</strong>. Podrás
                              reactivarla desde su detalle.
                            </>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!isFiltering && total > ROW_LIMIT && (
          <div className="border-t border-border p-2">
            {collapsed ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronDown className="h-3 w-3" />
                Ver {hidden} más
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ChevronUp className="h-3 w-3" />
                Mostrar menos
              </button>
            )}
          </div>
        )}
      </Card>

      {moveTarget && (
        <PartMovementDialog
          open
          onOpenChange={(o) => !o && setMoveTarget(null)}
          part={moveTarget}
        />
      )}
    </div>
  );
}
