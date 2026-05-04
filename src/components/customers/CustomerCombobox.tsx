import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCustomer, useCustomers } from '@/features/customers/hooks';
import { useDebouncedValue } from '@/lib/hooks';
import { cn } from '@/lib/utils';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  onCreateNew?: () => void;
  error?: string;
}

export default function CustomerCombobox({ value, onChange, onCreateNew, error }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);

  const list = useCustomers(debounced);
  const selected = useCustomer(value ?? undefined);

  const label = selected.data
    ? `${selected.data.name} · ${selected.data.phone}`
    : 'Elige un cliente...';

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
          className="w-[--radix-popover-trigger-width] min-w-[320px] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
            <CommandList>
              {list.isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
              ) : (
                <>
                  <CommandEmpty>
                    <div className="flex flex-col items-center gap-2 py-2">
                      <p>Sin coincidencias.</p>
                      {onCreateNew && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOpen(false);
                            onCreateNew();
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Crear cliente nuevo
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  {list.data?.map((c) => (
                    <CommandItem key={c.id} value={c.id} onSelect={() => pick(c.id)}>
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === c.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                      </div>
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
            {onCreateNew && (
              <div className="border-t p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear cliente nuevo
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
