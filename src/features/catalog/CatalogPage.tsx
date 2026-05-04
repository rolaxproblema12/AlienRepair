import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, ChevronDown, ChevronUp, Eye, EyeOff, Search, Settings } from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { filterCatalog } from '@/lib/catalog';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCanSeeCosts } from '@/lib/costVisibilityStore';
import { useCatalog, useLastCatalogUpdate, useMarkupSetting } from './hooks';
import {
  DEFAULT_MARKUP_MULTIPLIER,
  multiplierToMarkupPct,
  suggestedPrice,
  type CatalogProduct,
} from './types';
import CatalogProductDialog from './CatalogProductDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const ROW_LIMIT = 25;

export default function CatalogPage() {
  const { profile } = useAuth();
  const catalogQ = useCatalog();
  const markupQ = useMarkupSetting();
  const lastUpdate = useLastCatalogUpdate();
  const costs = useCanSeeCosts();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [category, setCategory] = useState<string | 'all'>('all');
  const [vendor, setVendor] = useState<string | 'all'>('all');
  const [expanded, setExpanded] = useState(false);
  const [openProduct, setOpenProduct] = useState<CatalogProduct | null>(null);

  const multiplier = markupQ.data ?? DEFAULT_MARKUP_MULTIPLIER;
  const markupPct = multiplierToMarkupPct(multiplier);

  const all = catalogQ.data ?? [];

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of all) {
      const k = p.category || '(sin categoría)';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const vendors = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of all) {
      const k = p.vendor || '(sin vendor)';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);

  const filtered = useMemo(
    () => filterCatalog(all, { search: debouncedSearch, category, vendor }),
    [all, debouncedSearch, category, vendor],
  );

  const isFiltering =
    debouncedSearch.trim().length > 0 || category !== 'all' || vendor !== 'all';

  useEffect(() => {
    if (isFiltering && expanded) setExpanded(false);
  }, [isFiltering, expanded]);

  const total = filtered.length;
  const collapsed = !isFiltering && !expanded && total > ROW_LIMIT;
  const visible = collapsed ? filtered.slice(0, ROW_LIMIT) : filtered;
  const hidden = total - visible.length;

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            {all.length.toLocaleString('es-MX')} refacciones
            {costs.canSee && <> · margen {markupPct}%</>}
            {lastUpdate.daysAgo != null && (
              <>
                {' · '}
                {lastUpdate.daysAgo === 0
                  ? 'actualizado hoy'
                  : `actualizado hace ${lastUpdate.daysAgo} día${lastUpdate.daysAgo === 1 ? '' : 's'}`}
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
          {profile?.role === 'admin' && (
            <Button asChild variant="outline">
              <Link to="/admin/catalogo">
                <Settings className="mr-2 h-4 w-4" />
                Configurar
              </Link>
            </Button>
          )}
        </div>
      </div>

      {lastUpdate.isStale && (
        <div className="flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-medium text-amber-200">
              Última actualización hace {lastUpdate.daysAgo} días
            </p>
            <p className="text-xs text-amber-200/70">
              Los precios pueden estar desactualizados. Pídele al admin que actualice el catálogo.
            </p>
          </div>
          {profile?.role === 'admin' && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/catalogo">Actualizar ahora</Link>
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, modelo, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(([name, count]) => (
              <SelectItem key={name} value={name}>
                {name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vendor} onValueChange={setVendor}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vendors</SelectItem>
            {vendors.map(([name, count]) => (
              <SelectItem key={name} value={name}>
                {name} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        {catalogQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !visible.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isFiltering ? 'Sin resultados con esos filtros.' : 'Catálogo vacío.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Modelos</TableHead>
                <TableHead>SKU</TableHead>
                {costs.canSee && <TableHead className="text-right">Compra</TableHead>}
                <TableHead className="text-right">
                  {costs.canSee ? 'Sugerido' : 'Precio'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => {
                const sug = suggestedPrice(p.price, multiplier);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setOpenProduct(p)}
                  >
                    <TableCell className="text-sm">
                      <div className="line-clamp-1 font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.vendor}</div>
                    </TableCell>
                    <TableCell>
                      {p.category ? (
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="line-clamp-1 max-w-xs">
                        {p.models.length ? p.models.join(', ') : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku || '—'}</TableCell>
                    {costs.canSee && (
                      <TableCell className="text-right text-sm font-mono">
                        {p.price != null ? currency(p.price) : '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-right text-sm font-mono font-semibold text-emerald-400">
                      {sug != null ? currency(sug) : '—'}
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
                Ver {hidden.toLocaleString('es-MX')} más
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

      <CatalogProductDialog
        product={openProduct}
        multiplier={multiplier}
        onOpenChange={(o) => !o && setOpenProduct(null)}
      />
    </div>
  );
}
