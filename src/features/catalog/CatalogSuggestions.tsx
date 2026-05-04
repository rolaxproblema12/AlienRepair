import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Lightbulb, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/lib/hooks';
import { matchSuggestions } from '@/lib/catalog';
import { detectSymptom, SYMPTOM_LABELS } from './categoryMap';
import { useCatalog, useMarkupSetting } from './hooks';
import { DEFAULT_MARKUP_MULTIPLIER, suggestedPrice } from './types';
import { currency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCanSeeCosts } from '@/lib/costVisibilityStore';

interface Props {
  brand: string | null | undefined;
  model: string | null | undefined;
  problem: string | null | undefined;
  onUseSuggestedPrice?: (price: number) => void;
}

export default function CatalogSuggestions({
  brand,
  model,
  problem,
  onUseSuggestedPrice,
}: Props) {
  const catalogQ = useCatalog();
  const markupQ = useMarkupSetting();
  const [collapsed, setCollapsed] = useState(false);
  const costs = useCanSeeCosts();

  const debouncedBrand = useDebouncedValue(brand ?? '', 350);
  const debouncedModel = useDebouncedValue(model ?? '', 350);
  const debouncedProblem = useDebouncedValue(problem ?? '', 350);

  const symptom = detectSymptom(debouncedProblem);
  const multiplier = markupQ.data ?? DEFAULT_MARKUP_MULTIPLIER;

  const matches = useMemo(() => {
    if (!catalogQ.data) return [];
    return matchSuggestions(catalogQ.data, debouncedBrand, debouncedModel, debouncedProblem, 5);
  }, [catalogQ.data, debouncedBrand, debouncedModel, debouncedProblem]);

  const hasInputs =
    (debouncedBrand.trim() || debouncedModel.trim()) && symptom !== null;

  if (!hasInputs) return null;

  async function copySku(sku: string) {
    try {
      await navigator.clipboard.writeText(sku);
      toast.success(`SKU ${sku} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setCollapsed((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-emerald-400" />
          Refacciones sugeridas
          {symptom && (
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {SYMPTOM_LABELS[symptom]}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {costs.isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  costs.toggle();
                }}
                title={costs.hidden ? 'Mostrar costos' : 'Ocultar costos'}
                className="rounded-md p-1 hover:bg-secondary hover:text-foreground"
              >
                {costs.hidden ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
            {matches.length} resultado{matches.length === 1 ? '' : 's'}
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron refacciones para {[debouncedBrand, debouncedModel].filter(Boolean).join(' ')}.
            </p>
          ) : (
            matches.map((p) => {
              const sug = suggestedPrice(p.price, multiplier);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.category}
                      {p.sku && (
                        <>
                          {' · '}
                          <span className="font-mono">{p.sku}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {costs.canSee && (
                      <div className="text-xs text-muted-foreground">
                        Compra {p.price != null ? currency(p.price) : '—'}
                      </div>
                    )}
                    <div className="text-sm font-mono font-semibold text-emerald-400">
                      {sug != null ? currency(sug) : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {sug != null && onUseSuggestedPrice && (
                      <button
                        type="button"
                        onClick={() => {
                          onUseSuggestedPrice(sug);
                          toast.success(`Costo establecido en ${currency(sug)}`);
                        }}
                        title="Usar este precio como costo"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Wand2 className="h-4 w-4" />
                      </button>
                    )}
                    {p.sku && (
                      <button
                        type="button"
                        onClick={() => copySku(p.sku)}
                        title="Copiar SKU"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      )}
    </Card>
  );
}
