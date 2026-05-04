import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { currency } from '@/lib/format';
import { suggestedPrice, type CatalogProduct } from './types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCanSeeCosts } from '@/lib/costVisibilityStore';

interface Props {
  product: CatalogProduct | null;
  multiplier: number;
  onOpenChange: (open: boolean) => void;
}

export default function CatalogProductDialog({ product, multiplier, onOpenChange }: Props) {
  const open = product != null;
  const sug = product ? suggestedPrice(product.price, multiplier) : null;
  const costs = useCanSeeCosts();

  async function copySku() {
    if (!product?.sku) return;
    try {
      await navigator.clipboard.writeText(product.sku);
      toast.success(`SKU ${product.sku} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{product.title}</DialogTitle>
              <DialogDescription>{product.vendor}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className={costs.canSee ? 'grid grid-cols-2 gap-3' : ''}>
                {costs.canSee && (
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Precio compra</p>
                    <p className="mt-1 text-lg font-mono font-semibold">
                      {product.price != null ? currency(product.price) : '—'}
                    </p>
                  </div>
                )}
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs text-emerald-300">
                    {costs.canSee ? `Sugerido (×${multiplier})` : 'Precio recomendado'}
                  </p>
                  <p className="mt-1 text-lg font-mono font-semibold text-emerald-400">
                    {sug != null ? currency(sug) : '—'}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Categoría
                </p>
                <p className="text-sm">{product.category || '(sin categoría)'}</p>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  SKU
                </p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-secondary px-2 py-1 font-mono text-sm">
                    {product.sku || '—'}
                  </code>
                  {product.sku && (
                    <Button variant="ghost" size="sm" onClick={copySku}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  )}
                </div>
              </div>

              {product.models.length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Modelos compatibles ({product.models.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.models.map((m, i) => (
                      <span
                        key={`${m}-${i}`}
                        className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
