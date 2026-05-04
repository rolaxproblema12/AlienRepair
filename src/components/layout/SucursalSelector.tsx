import { Building2, Check, ChevronDown } from 'lucide-react';
import { useCurrentSucursal, useSetCurrentSucursal } from '@/features/sucursales/hooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function SucursalSelector() {
  const { current, sucursales, isLoading } = useCurrentSucursal();
  const setCurrent = useSetCurrentSucursal();

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        Cargando…
      </div>
    );
  }

  if (!current) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
        <Building2 className="h-3.5 w-3.5" />
        Sin sucursal asignada
      </div>
    );
  }

  // Solo una sucursal accesible: badge read-only, sin dropdown
  if (sucursales.length <= 1) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">{current.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{current.code}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
        >
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">{current.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{current.code}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Cambiar sucursal
        </p>
        {sucursales.map((s) => {
          const isCurrent = s.id === current.id;
          return (
            <DropdownMenuItem
              key={s.id}
              onClick={() => !isCurrent && setCurrent(s.id)}
              className={cn('cursor-pointer', isCurrent && 'bg-accent/50')}
            >
              <Check
                className={cn(
                  'h-3.5 w-3.5',
                  isCurrent ? 'text-primary' : 'invisible'
                )}
              />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
