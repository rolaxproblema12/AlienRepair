import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  useOrderForExpense,
  useOrdersForExpenseSearch,
  type OrderForExpenseRow,
} from './hooks';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
}

function describeOrder(o: OrderForExpenseRow): string {
  const detail =
    o.kind === 'reparacion'
      ? [o.brand, o.model].filter(Boolean).join(' ') || 'Reparación'
      : o.item_description ?? '—';
  return `#${o.folio} · ${o.customer?.name ?? 'Sin cliente'} · ${detail}`;
}

export default function OrderForExpenseCombobox({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);

  const list = useOrdersForExpenseSearch(debounced);
  const selected = useOrderForExpense(value);

  const label = selected.data ? describeOrder(selected.data) : 'Selecciona la orden...';

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !selected.data && 'text-muted-foreground',
              error && 'border-destructive',
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-[360px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por folio, cliente, marca/modelo..."
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
            <CommandList>
              {list.isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Buscando...
                </div>
              ) : (
                <>
                  <CommandEmpty>Sin coincidencias.</CommandEmpty>
                  {list.data?.map((o) => (
                    <CommandItem key={o.id} value={o.id} onSelect={() => pick(o.id)}>
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === o.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate">{describeOrder(o)}</span>
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
