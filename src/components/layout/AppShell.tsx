import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOverdueOrdersCount } from '@/features/orders/hooks';
import { useRealtimeOrders } from '@/features/orders/useRealtimeOrders';
import { useOverdueLoginToast } from '@/features/orders/useOverdueLoginToast';
import CommandPalette from './CommandPalette';
import SucursalSelector from './SucursalSelector';
import UpdateBanner from '@/components/UpdateBanner';
import UpdateCheckButton from '@/components/UpdateCheckButton';
import {
  LayoutDashboard,
  Wrench,
  Users,
  Package,
  ShoppingBag,
  Boxes,
  Cpu,
  BookOpen,
  Wallet,
  CalendarDays,
  BarChart3,
  Receipt,
  Shield,
  LogOut,
  AlertTriangle,
  Search,
  History,
  FileText,
  Tag,
  Upload,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/caja', label: 'Caja', icon: Wallet },
  { to: '/reparaciones', label: 'Reparaciones', icon: Wrench },
  { to: '/encargos', label: 'Encargos', icon: Package },
  { to: '/accesorios', label: 'Accesorios', icon: ShoppingBag },
  { to: '/inventario', label: 'Inventario', icon: Boxes },
  { to: '/piezas', label: 'Piezas', icon: Cpu },
  { to: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/gastos', label: 'Gastos', icon: Receipt, adminOnly: true },
  { to: '/contabilidad', label: 'Contabilidad', icon: BarChart3, adminOnly: true },
];

// Rutas admin que no leen/escriben datos transaccionales y por tanto pueden
// renderizarse sin sucursal activa (ej: para crear la primera).
const SUCURSAL_AGNOSTIC_PREFIXES = ['/admin/sucursales', '/admin/users', '/admin/codes'];

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const { current: currentSucursal, sucursales, isLoading: sucursalLoading } =
    useCurrentSucursal();
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const isAgnosticRoute = SUCURSAL_AGNOSTIC_PREFIXES.some((p) =>
    location.pathname.startsWith(p)
  );
  // Bootstrapping = lista cargada con sucursales pero el store aún no tiene
  // currentSucursalId fijado. El effect en useCurrentSucursal lo va a setear
  // en el próximo tick; durante ese render mostramos loading en lugar de
  // NoSucursalScreen para evitar el flash y, sobre todo, evitar montar
  // hooks scopeados que tirarían.
  const isBootstrapping = !sucursalLoading && !currentSucursal && sucursales.length > 0;
  const truelyNoSucursal = !sucursalLoading && !currentSucursal && sucursales.length === 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/reparaciones/nueva');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
            <Wrench className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">AlienRepair</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems
            .filter((item) => !item.adminOnly || profile?.role === 'admin')
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}

          {currentSucursal && <OverdueNavLink />}

          {profile?.role === 'admin' && (
            <div className="pt-2">
              <p className="mb-1 px-3 text-xs uppercase tracking-wide text-muted-foreground">
                Admin
              </p>
              <AdminLink to="/admin/sucursales" icon={Building2} label="Sucursales" />
              <AdminLink to="/admin/codes" icon={Shield} label="Códigos" />
              <AdminLink to="/admin/users" icon={Users} label="Usuarios" />
              <AdminLink to="/admin/categorias" icon={Tag} label="Categorías" />
              <AdminLink to="/admin/inventario-import" icon={Upload} label="Importar inventario" />
              <AdminLink to="/admin/catalogo" icon={BookOpen} label="Catálogo" />
              <AdminLink to="/admin/audit" icon={History} label="Auditoría" />
              <AdminLink to="/informes/login" icon={FileText} label="Informe de login" />
            </div>
          )}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">
            {profile?.email}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden bg-background">
        <UpdateBanner />
        <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-border px-4">
          <SucursalSelector />
          <UpdateCheckButton />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar
            <kbd className="ml-2 rounded bg-background px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl K
            </kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sucursalLoading || isBootstrapping ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Cargando sucursales…
            </div>
          ) : truelyNoSucursal && !isAgnosticRoute ? (
            <NoSucursalScreen isAdmin={profile?.role === 'admin'} />
          ) : !currentSucursal ? (
            // Ruta admin agnóstica (ej: /admin/sucursales) sin sucursal activa —
            // render directo sin montar hooks scopeados.
            <Outlet />
          ) : (
            // Wrapper que monta los hooks scopeados (overdue, realtime, login toast)
            // SOLO cuando hay sucursal activa, evitando que useScopedSucursalId tire.
            <ScopedShellContent />
          )}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

// Componente interno que usa hooks scopeados. Solo se monta cuando hay
// sucursal activa, así useScopedSucursalId() nunca tira aquí dentro.
function ScopedShellContent() {
  useRealtimeOrders();
  useOverdueLoginToast();
  return <Outlet />;
}

// NavLink de "Retrasados" extraído porque depende de un hook scopeado.
function OverdueNavLink() {
  const overdue = useOverdueOrdersCount();
  if ((overdue.data ?? 0) <= 0) return null;
  return (
    <NavLink
      to="/retrasados"
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-destructive hover:bg-destructive/10'
        )
      }
    >
      <AlertTriangle className="h-4 w-4" />
      <span className="flex-1">Retrasados</span>
      <Badge variant="destructive">{overdue.data}</Badge>
    </NavLink>
  );
}

function NoSucursalScreen({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Sin sucursal asignada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {isAdmin
            ? 'Aún no hay sucursales en el sistema o no estás asignado a ninguna. Crea la primera sucursal para empezar.'
            : 'El administrador todavía no te ha asignado a ninguna sucursal. Pídele que lo haga desde Admin → Usuarios.'}
        </p>
      </div>
      {isAdmin && (
        <Button asChild>
          <Link to="/admin/sucursales">
            <Building2 className="mr-2 h-4 w-4" />
            Administrar sucursales
          </Link>
        </Button>
      )}
    </div>
  );
}

function AdminLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Shield;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
