import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useOrdersWithBalance } from './hooks';
import { useDebouncedValue } from '@/lib/hooks';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export interface RepairPickResult {
  order_id: string;
  folio: string;
  description: string;
  amount: number;
  balance: number;
  customer_name: string;
}

interface Props {
  onPick: (r: RepairPickResult, customAmount?: number) => void;
}

export default function RepairPicker({ onPick }: Props) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { data, isLoading } = useOrdersWithBalance(debounced);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por folio, cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {debounced
            ? 'Sin órdenes con saldo pendiente.'
            : 'Busca una orden o folio para ver su saldo.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((o) => {
            const detail =
              o.kind === 'reparacion'
                ? [o.brand, o.model].filter(Boolean).join(' ')
                : o.item_description ?? '';
            const customStr = customAmounts[o.id] ?? '';
            const customNum = Number(customStr);
            const useCustom = customStr !== '' && !Number.isNaN(customNum) && customNum > 0;
            const amount = Math.min(useCustom ? customNum : o.balance, o.balance);

            return (
              <li
                key={o.id}
                className="flex items-center gap-3 rounded-md border border-border bg-card p-2 transition hover:border-primary/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-primary">
                      OS-{o.folio}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-medium uppercase',
                        o.kind === 'reparacion'
                          ? 'bg-orange-500/15 text-orange-400'
                          : o.kind === 'encargo'
                            ? 'bg-violet-500/15 text-violet-400'
                            : 'bg-emerald-500/15 text-emerald-400',
                      )}
                    >
                      {o.kind}
                    </span>
                  </div>
                  <div className="line-clamp-1 text-sm font-medium">
                    {o.customer.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {detail || '—'} · Saldo:{' '}
                    <strong className="text-destructive">{currency(o.balance)}</strong>{' '}
                    de {currency(o.total)}
                  </div>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={o.balance}
                  placeholder={String(o.balance.toFixed(2))}
                  value={customStr}
                  onChange={(e) =>
                    setCustomAmounts((m) => ({ ...m, [o.id]: e.target.value }))
                  }
                  className="w-28 text-right"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onPick(
                      {
                        order_id: o.id,
                        folio: o.folio,
                        description: `Abono OS-${o.folio} (${o.customer.name})`,
                        amount,
                        balance: o.balance,
                        customer_name: o.customer.name,
                      },
                      amount,
                    );
                    setCustomAmounts((m) => {
                      const { [o.id]: _, ...rest } = m;
                      return rest;
                    });
                  }}
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
