import { useState } from 'react';
import { Plus, ScanBarcode, Search } from 'lucide-react';
import { useProducts, findProductByBarcode } from '@/features/inventory/hooks';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import type { ProductWithCategory } from '@/features/inventory/types';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  onPick: (product: ProductWithCategory) => void;
}

export default function ProductPicker({ onPick }: Props) {
  const sucursalId = useScopedSucursalId();
  const [search, setSearch] = useState('');
  const [barcode, setBarcode] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { data, isLoading } = useProducts({
    search: debounced,
    categoryId: 'all',
    includeInactive: false,
  });

  async function handleBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const p = await findProductByBarcode(trimmed, sucursalId);
      if (p) {
        onPick(p);
        setBarcode('');
      } else {
        toast.error(`Sin producto con código ${trimmed}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU, marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative w-48">
          <ScanBarcode className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Código de barras"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBarcode(barcode);
              }
            }}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {debounced ? 'Sin coincidencias.' : 'Empieza a buscar productos del inventario.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.slice(0, 30).map((p) => {
            const lowStock = p.stock <= 0;
            return (
              <li
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border border-border bg-card p-2 transition hover:border-primary/40',
                  lowStock && 'opacity-60',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-primary">{p.sku}</span>
                    {p.category && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium',
                          p.category.color
                            ? `${p.category.color} text-white`
                            : 'bg-secondary text-secondary-foreground',
                        )}
                      >
                        {p.category.name}
                      </span>
                    )}
                  </div>
                  <div className="line-clamp-1 text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Stock: <strong className={cn(lowStock && 'text-destructive')}>{p.stock}</strong>{' '}
                    · {currency(p.sale_price)}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onPick(p)}
                  disabled={lowStock}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
