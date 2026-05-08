import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { useProducts } from '@/features/inventory/hooks';
import { useParts } from '@/features/parts/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MAX_ITEMS = 5;

interface LowStockItem {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  type: 'producto' | 'pieza';
  link: string;
  /** stock - min: cuanto MÁS abajo del umbral está. Negativo = más urgente. */
  delta: number;
}

/**
 * Card "Stock crítico": top 5 items (productos + piezas) con stock bajo el
 * mínimo configurado, ordenados por urgencia (delta = stock - minStock).
 */
export default function LowStockCard() {
  const products = useProducts({ lowStock: true });
  const parts = useParts({ lowStock: true });

  const isLoading = products.isLoading || parts.isLoading;

  const items: LowStockItem[] = [
    ...(products.data ?? [])
      .filter((p) => p.min_stock != null)
      .map((p) => ({
        id: `product-${p.id}`,
        name: p.name,
        stock: p.stock,
        minStock: p.min_stock!,
        type: 'producto' as const,
        link: `/inventario/${p.id}`,
        delta: p.stock - (p.min_stock ?? 0),
      })),
    ...(parts.data ?? [])
      .filter((p) => p.min_stock != null)
      .map((p) => ({
        id: `part-${p.id}`,
        name: [p.brand, p.model, p.name].filter(Boolean).join(' ') || p.name,
        stock: p.stock,
        minStock: p.min_stock!,
        type: 'pieza' as const,
        link: `/piezas/${p.id}`,
        delta: p.stock - (p.min_stock ?? 0),
      })),
  ].sort((a, b) => a.delta - b.delta);

  const top = items.slice(0, MAX_ITEMS);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Stock crítico</CardTitle>
        </div>
        <Button variant="link" asChild className="h-auto p-0 text-xs">
          <Link to="/inventario">
            Ver inventario
            <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 opacity-50" />
            <p>Stock OK · todos los items por arriba del mínimo.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {top.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.link}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2 transition hover:border-primary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="muted" className="mr-1 text-[9px] uppercase">
                        {item.type}
                      </Badge>
                      stock {item.stock} / mín {item.minStock}
                    </p>
                  </div>
                  <span
                    className={
                      item.stock <= 0
                        ? 'text-xs font-mono font-semibold text-destructive'
                        : 'text-xs font-mono font-semibold text-amber-500'
                    }
                  >
                    {item.stock}
                  </span>
                </Link>
              </li>
            ))}
            {items.length > MAX_ITEMS && (
              <li className="pt-1 text-center text-xs text-muted-foreground">
                +{items.length - MAX_ITEMS} más
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
