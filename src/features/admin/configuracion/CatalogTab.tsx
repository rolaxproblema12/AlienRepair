import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useMarkupSetting, useUpdateMarkupSetting } from '@/features/catalog/hooks';
import {
  multiplierToMarkupPct,
  markupPctToMultiplier,
  DEFAULT_MARKUP_MULTIPLIER,
} from '@/features/catalog/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { Field } from './Field';

export function CatalogTab() {
  const markupQ = useMarkupSetting();
  const update = useUpdateMarkupSetting();
  // Patrón override: el input arranca como null y deriva del server hasta que el
  // usuario lo edita. Evita sincronizar via useEffect (set-state-in-effect).
  const [override, setOverride] = useState<string | null>(null);
  const markupInput =
    override ??
    (markupQ.data != null ? String(multiplierToMarkupPct(markupQ.data)) : '');
  const setMarkupInput = setOverride;

  const currentMultiplier = markupQ.data ?? DEFAULT_MARKUP_MULTIPLIER;
  const previewSale =
    Math.round(100 * markupPctToMultiplier(Number(markupInput || 0)) * 100) / 100;

  async function handleSave() {
    const pct = Number(markupInput);
    if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
      toast.error('Margen inválido (0 a 1000)');
      return;
    }
    try {
      await update.mutateAsync(markupPctToMultiplier(pct));
      toast.success(`Margen guardado: ${pct}%`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margen sugerido del catálogo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Multiplicador aplicado al precio de compra para sugerir el precio de venta. Por
          ejemplo, 150% significa que una pieza de $100 se sugiere a $250. Setting global del
          sistema (no per-sucursal). Valor actual: {multiplierToMarkupPct(currentMultiplier)}%.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Margen %">
            <Input
              type="number"
              min={0}
              max={1000}
              step={5}
              value={markupInput}
              onChange={(e) => setMarkupInput(e.target.value)}
            />
          </Field>
          <Field label="Vista previa">
            <div className="rounded-md border border-input bg-secondary px-3 py-2 text-sm font-mono">
              $100 → ${previewSale.toFixed(2)}
            </div>
          </Field>
        </div>
        <Button onClick={handleSave} disabled={update.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {update.isPending ? 'Guardando…' : 'Guardar margen'}
        </Button>
      </CardContent>
    </Card>
  );
}
