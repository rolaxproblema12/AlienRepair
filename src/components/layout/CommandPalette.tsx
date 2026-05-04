import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Package,
  Receipt,
  Shield,
  ShoppingBag,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCustomers } from '@/features/customers/hooks';
import { useOrders } from '@/features/orders/hooks';
import { KIND_LABELS } from '@/features/orders/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMaybeSucursalId } from '@/features/sucursales/useScopedSucursalId';
import { useDebouncedValue } from '@/lib/hooks';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function orderRoute(kind: 'reparacion' | 'encargo' | 'accesorio', id: string) {
  if (kind === 'encargo') return `/encargos/${id}`;
  if (kind === 'accesorio') return `/accesorios/${id}`;
  return `/reparaciones/${id}`;
}

// El palette se renderiza siempre, pero cuando no hay sucursal activa
// (admin sin asignar / DB vacía) solo expone navegación y crear, no búsqueda.
export default function CommandPalette(props: Props) {
  const sucursalId = useMaybeSucursalId();
  if (!sucursalId) return <NavOnlyPalette {...props} />;
  return <FullPalette {...props} />;
}

function FullPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  const customers = useCustomers(debouncedQuery);
  const orders = useOrders({ search: debouncedQuery });

  // Reset al cerrar para que la próxima Ctrl+K abra con el input limpio.
  // setState-in-effect es intencional acá: el `open` lo controla el padre,
  // así que no hay un único onOpenChange donde meter el reset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery('');
  }, [open]);

  function go(path: string) {
    onOpenChange(false);
    navigate(path);
  }

  const isAdmin = profile?.role === 'admin';
  const navActions = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Reparaciones', icon: Wrench, path: '/reparaciones' },
    { label: 'Encargos', icon: Package, path: '/encargos' },
    { label: 'Accesorios', icon: ShoppingBag, path: '/accesorios' },
    { label: 'Clientes', icon: Users, path: '/clientes' },
    { label: 'Agenda', icon: CalendarDays, path: '/agenda' },
    ...(isAdmin
      ? [
          { label: 'Gastos', icon: Receipt, path: '/gastos' },
          { label: 'Contabilidad', icon: BarChart3, path: '/contabilidad' },
        ]
      : []),
  ];

  const quickCreate = [
    { label: 'Nueva reparación', path: '/reparaciones/nueva' },
    { label: 'Nuevo encargo', path: '/encargos/nuevo' },
    { label: 'Nuevo accesorio', path: '/accesorios/nuevo' },
    { label: 'Nuevo cliente', path: '/clientes' },
  ];

  const matchedOrders = (orders.data ?? []).slice(0, 8);
  const matchedCustomers = (customers.data ?? []).slice(0, 8);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar folio, cliente, equipo..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>

        {query && matchedOrders.length > 0 && (
          <CommandGroup heading="Órdenes">
            {matchedOrders.map((o) => {
              const detail =
                o.kind === 'reparacion'
                  ? [o.brand, o.model].filter(Boolean).join(' ') || 'Reparación'
                  : o.item_description ?? '—';
              return (
                <CommandItem
                  key={o.id}
                  value={`${o.folio} ${o.customer?.name ?? ''} ${detail}`}
                  onSelect={() => go(orderRoute(o.kind, o.id))}
                >
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">#{o.folio}</span>
                  <span className="flex-1 truncate">
                    {o.customer?.name ?? 'Sin cliente'} · {detail}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {KIND_LABELS[o.kind]}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query && matchedCustomers.length > 0 && (
          <CommandGroup heading="Clientes">
            {matchedCustomers.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name} ${c.phone}`}
                onSelect={() => go(`/clientes/${c.id}`)}
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Crear">
          {quickCreate.map((q) => (
            <CommandItem key={q.path} onSelect={() => go(q.path)}>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              {q.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Ir a">
          {navActions.map((n) => (
            <CommandItem key={n.path} onSelect={() => go(n.path)}>
              <n.icon className="h-4 w-4 text-muted-foreground" />
              {n.label}
            </CommandItem>
          ))}
          {isAdmin && (
            <>
              <CommandItem onSelect={() => go('/admin/sucursales')}>
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin · Sucursales
              </CommandItem>
              <CommandItem onSelect={() => go('/admin/codes')}>
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin · Códigos
              </CommandItem>
              <CommandItem onSelect={() => go('/admin/users')}>
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin · Usuarios
              </CommandItem>
              <CommandItem onSelect={() => go('/admin/audit')}>
                <Shield className="h-4 w-4 text-muted-foreground" />
                Admin · Auditoría
              </CommandItem>
            </>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function NavOnlyPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  function go(path: string) {
    onOpenChange(false);
    navigate(path);
  }
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Selecciona una sucursal para buscar..." disabled />
      <CommandList>
        <CommandGroup heading="Ir a">
          {profile?.role === 'admin' && (
            <CommandItem onSelect={() => go('/admin/sucursales')}>
              <Shield className="h-4 w-4 text-muted-foreground" />
              Admin · Sucursales
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
