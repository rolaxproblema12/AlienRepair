import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateSale, useCurrentSession } from './hooks';
import { calcLineTotal, type CartLine, type SalePaymentMethod } from './types';
import { PAYMENT_METHOD_LABELS } from './types';
import ProductPicker from './ProductPicker';
import RepairPicker, { type RepairPickResult } from './RepairPicker';
import CustomerCombobox from '@/components/customers/CustomerCombobox';
import type { ProductWithCategory } from '@/features/inventory/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

type Tab = 'producto' | 'reparacion';

// Una línea editable de pago en el panel "Pagos". Mantenemos `amount`
// como string para que el input no force conversión hasta el submit.
interface PaymentSplitRow {
  key: string;
  method: SalePaymentMethod;
  amount: string;
}

export default function NewSalePage() {
  const navigate = useNavigate();
  const sessionQ = useCurrentSession();
  const create = useCreateSale();

  const [tab, setTab] = useState<Tab>('producto');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [splits, setSplits] = useState<PaymentSplitRow[]>([
    { key: crypto.randomUUID(), method: 'efectivo', amount: '' },
  ]);
  const [notes, setNotes] = useState('');

  // Si la sesión de caja se cerró (otra PC vía realtime, o cambio de sucursal),
  // redirige sin saltarse hooks. Antes el `if + return null` antes de useMemo
  // hacía que React viera distinto número de hooks entre renders y crasheara.
  const noSession = !sessionQ.isLoading && !sessionQ.data;
  useEffect(() => {
    if (noSession) navigate('/caja');
  }, [noSession, navigate]);

  function addProduct(p: ProductWithCategory) {
    const existing = lines.find((l) => l.product_id === p.id);
    if (existing) {
      setLines((prev) =>
        prev.map((l) =>
          l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        kind: 'producto',
        product_id: p.id,
        order_id: null,
        description: p.name,
        quantity: 1,
        unit_price: Number(p.sale_price),
        unit_cost: Number(p.cost_price),
        iva_rate: Number(p.iva_rate),
        discount: 0,
        stock_available: p.stock,
      },
    ]);
  }

  function addRepair(r: RepairPickResult, amount?: number) {
    if (lines.find((l) => l.order_id === r.order_id)) {
      toast.error('Ya hay un abono para esa orden en el carrito.');
      return;
    }
    const final = amount ?? r.balance;
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        kind: 'abono_orden',
        product_id: null,
        order_id: r.order_id,
        description: r.description,
        quantity: 1,
        unit_price: final,
        unit_cost: 0,
        iva_rate: 0,
        discount: 0,
        reference_label: `OS-${r.folio}`,
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    let discount = 0;
    let total = 0;
    for (const l of lines) {
      const lt = calcLineTotal(l);
      const ivaPart = lt - lt / (1 + Number(l.iva_rate));
      subtotal += lt - ivaPart;
      iva += ivaPart;
      discount += Number(l.discount) || 0;
      total += lt;
    }
    return { subtotal, iva, discount, total };
  }, [lines]);

  async function handleCheckout() {
    if (!sessionQ.data) return;
    if (!lines.length) {
      toast.error('Agrega al menos una línea.');
      return;
    }
    // Validar stock antes de enviar
    for (const l of lines) {
      if (l.kind === 'producto' && l.stock_available != null && l.quantity > l.stock_available) {
        toast.error(`Stock insuficiente para ${l.description}.`);
        return;
      }
    }
    // Validar pagos: convertir strings a números, dropear vacíos, validar sum.
    const payments = splits
      .map((s) => ({ payment_method: s.method, amount: Number(s.amount) }))
      .filter((p) => Number.isFinite(p.amount) && p.amount > 0);
    if (!payments.length) {
      toast.error('Captura al menos un método de pago con monto.');
      return;
    }
    const sumPaid = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(sumPaid - totals.total) > 0.02) {
      toast.error(
        `Pagos suman ${sumPaid.toFixed(2)} pero el total es ${totals.total.toFixed(2)}.`,
      );
      return;
    }
    try {
      const sale = await create.mutateAsync({
        cashSessionId: sessionQ.data.id,
        customerId,
        payments,
        notes: notes.trim() || null,
        lines,
      });
      toast.success(`VTA-${sale.folio} registrada`);
      navigate(`/caja/${sale.id}`);
    } catch (err) {
      console.error('[NewSalePage] checkout error:', err);
      const msg = getErrorMessage(err);
      // Detectamos el rejection del trigger prevent_negative_stock — la
      // validación client-side puede pasar y la DB rechazar si entre
      // medio se vendió el mismo producto desde otra sucursal.
      if (/stock/i.test(msg)) {
        toast.error(
          'Stock insuficiente al registrar. Es posible que otra venta consumió el producto. Recarga el inventario.',
        );
      } else {
        toast.error(msg);
      }
    }
  }

  // Helpers para gestionar splits.
  function addSplit() {
    setSplits((prev) => [
      ...prev,
      { key: crypto.randomUUID(), method: 'efectivo', amount: '' },
    ]);
  }
  function removeSplit(key: string) {
    setSplits((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }
  function updateSplit(key: string, patch: Partial<PaymentSplitRow>) {
    setSplits((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }
  // Suma actual de splits (para mostrar "restante").
  const splitsSum = splits.reduce(
    (s, x) => s + (Number.isFinite(Number(x.amount)) ? Number(x.amount) : 0),
    0,
  );
  const remaining = totals.total - splitsSum;

  // Render-only short-circuit: ya pasamos por todos los hooks arriba, así
  // que el orden es estable. El effect de arriba se encarga del redirect.
  if (noSession) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-8 pt-8">
        <Button asChild variant="ghost" size="icon">
          <Link to="/caja">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>
      </div>

      <div className="grid flex-1 gap-4 px-8 py-6 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <div className="inline-flex w-full rounded-md border border-border bg-card p-0.5">
              {(['producto', 'reparacion'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition',
                    tab === t
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'producto' ? 'Productos' : 'Cobrar reparación'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {tab === 'producto' ? (
              <ProductPicker onPick={addProduct} />
            ) : (
              <RepairPicker onPick={addRepair} />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <CardTitle>Carrito</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {lines.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Agrega productos o un abono.
                </p>
              ) : (
                lines.map((l) => (
                  <div
                    key={l.key}
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-2 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {l.reference_label && (
                          <span className="font-mono text-[10px] text-primary">
                            {l.reference_label}
                          </span>
                        )}
                        {l.kind === 'producto' && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                            Producto
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-1 font-medium">{l.description}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        {l.kind === 'producto' && (
                          <>
                            <Input
                              type="number"
                              min={1}
                              step="1"
                              value={l.quantity}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  quantity: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                              className="h-7 w-14 text-xs"
                            />
                            <span>×</span>
                          </>
                        )}
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={l.unit_price}
                          onChange={(e) =>
                            updateLine(l.key, {
                              unit_price: Number(e.target.value) || 0,
                            })
                          }
                          className="h-7 w-24 text-xs"
                        />
                        {l.kind === 'producto' && (
                          <>
                            <span className="ml-1">desc</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.discount}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  discount: Number(e.target.value) || 0,
                                })
                              }
                              className="h-7 w-20 text-xs"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {currency(calcLineTotal(l))}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeLine(l.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={currency(totals.subtotal)} />
                <Row label="IVA" value={currency(totals.iva)} />
                {totals.discount > 0 && (
                  <Row label="Descuentos" value={`−${currency(totals.discount)}`} />
                )}
                <div className="my-2 h-px bg-border" />
                <Row label="TOTAL" value={currency(totals.total)} strong />
              </div>

              <div className="space-y-1">
                <Label>Cliente (opcional)</Label>
                <CustomerCombobox value={customerId} onChange={setCustomerId} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pagos</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={addSplit}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Otro método
                  </Button>
                </div>
                {splits.map((s) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="inline-flex flex-1 rounded-md border border-border bg-card p-0.5">
                      {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => updateSplit(s.key, { method: m })}
                          className={cn(
                            'flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition',
                            s.method === m
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {PAYMENT_METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0.00"
                      className="w-28 text-right"
                      value={s.amount}
                      onChange={(e) => updateSplit(s.key, { amount: e.target.value })}
                    />
                    {splits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplit(s.key)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Quitar pago"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {Math.abs(remaining) > 0.005 && (
                  <p
                    className={cn(
                      'text-xs',
                      remaining > 0 ? 'text-amber-400' : 'text-destructive',
                    )}
                  >
                    {remaining > 0
                      ? `Restante: ${currency(remaining)}`
                      : `Excedido por ${currency(-remaining)}`}
                    {remaining > 0 && splits.length === 1 && (
                      <button
                        type="button"
                        className="ml-2 underline hover:text-foreground"
                        onClick={() =>
                          updateSplit(splits[0].key, { amount: totals.total.toFixed(2) })
                        }
                      >
                        Cubrir total
                      </button>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={create.isPending || lines.length === 0}
              >
                {create.isPending ? 'Cobrando...' : `Cobrar ${currency(totals.total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-xs', strong && 'text-sm font-semibold')}>{label}</span>
      <span
        className={cn(
          'font-mono text-sm',
          strong && 'text-2xl font-bold tracking-tight',
        )}
      >
        {value}
      </span>
    </div>
  );
}
