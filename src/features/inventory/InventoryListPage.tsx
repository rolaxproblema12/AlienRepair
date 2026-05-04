import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCategories,
  useDeleteProduct,
  useProducts,
} from './hooks';
import { isLowStock, marginPct, type ProductWithCategory } from './types';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import BarcodeScanInput from './BarcodeScanInput';
import MovementDialog from './MovementDialog';
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

const ROW_LIMIT = 20;

export default function InventoryListPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [categoryId, setCategoryId] = useState<string | 'all'>('all');
  const [lowStock, setLowStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [moveTarget, setMoveTarget] = useState<ProductWithCategory | null>(null);

  const categoriesQ = useCategories();
  const productsQ = useProducts({
    search: debouncedSearch,
    categoryId,
    lowStock,
    includeInactive,
  });
  const del = useDeleteProduct();

  const isFiltering =
    debouncedSearch.trim().length > 0 ||
    categoryId !== 'all' ||
    lowStock ||
    includeInactive;

  const total = productsQ.data?.length ?? 0;
  const lowStockCount = useMemo(
    () => (productsQ.data ?? []).filter(isLowStock).length,
    [productsQ.data],
  );
  const collapsed = !isFiltering && !expanded && total > ROW_LIMIT;
  const visible = collapsed ? productsQ.data!.slice(0, ROW_LIMIT) : productsQ.data ?? [];
  const hidden = total - visible.length;

  async function handleDelete(p: ProductWithCategory) {
    try {
      await del.mutateAsync(p.id);
      toast.success(`Producto "${p.name}" desactivado`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'producto' : 'productos'}
            {lowStockCount > 0 && (
              <>
                {' · '}
                <span className="text-destructive">
                  {lowStockCount} en stock bajo
                </span>
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link to="/inventario/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU, marca, modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <BarcodeScanInput />

        <Select value={categoryId} onValueChange={(v) => setCategoryId(v as string)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(categoriesQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
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
          Incluir inactivos
        </button>
      </div>

      <Card>
        {productsQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isFiltering
                ? 'Sin resultados con esos filtros.'
                : 'Aún no hay productos. Crea el primero.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="w-[140px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => {
                const low = isLowStock(p);
                const margin = marginPct(p);
                return (
                  <TableRow key={p.id} className={!p.active ? 'opacity-60' : ''}>
                    <TableCell>
                      <Link
                        to={`/inventario/${p.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="line-clamp-1 font-medium">{p.name}</div>
                      {(p.brand || p.model) && (
                        <div className="text-xs text-muted-foreground">
                          {[p.brand, p.model].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.category && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                            p.category.color
                              ? `${p.category.color} text-white`
                              : 'bg-secondary text-secondary-foreground',
                          )}
                        >
                          {p.category.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right text-sm font-mono',
                        low && 'text-destructive font-semibold',
                      )}
                    >
                      {p.stock}
                      {p.min_stock != null && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          / {p.min_stock}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {currency(p.sale_price)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {margin.toFixed(1)}%
                    </TableCell>
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
                          <Link to={`/inventario/${p.id}/editar`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <DeleteButton
                          onConfirm={() => handleDelete(p)}
                          description={
                            <>
                              Se desactivará el producto <strong>{p.name}</strong>. Podrás
                              reactivarlo desde el detalle.
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
        <MovementDialog
          open
          onOpenChange={(o) => !o && setMoveTarget(null)}
          product={moveTarget}
        />
      )}
    </div>
  );
}
