import { Link } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import KpiStrip from './KpiStrip';
import TodayAgendaCard from './TodayAgendaCard';
import CashTodayCard from './CashTodayCard';
import LowStockCard from './LowStockCard';
import OrderStatusBreakdownCard from './OrderStatusBreakdownCard';
import TopProductsCard from './TopProductsCard';
import EmployeeSalesCard from './EmployeeSalesCard';
import RevenueCard from './RevenueCard';

/**
 * Tablero operativo del taller. 4 rows:
 *   - Row 1: KPI Strip (4 mini-cards) — siempre.
 *   - Row 2: Operativa (Hoy en agenda, Caja del día, Stock crítico) — siempre.
 *   - Row 3: Gestión (Distribución OS, Top productos) — solo admin.
 *   - Row 4: Tendencia (Revenue 7d, Empleados) — solo admin.
 *
 * Sin Quick Actions: la sidebar ya tiene esos links siempre visibles.
 * El header tiene CTAs para las 2 acciones más comunes (Nueva venta /
 * Nueva orden). El resto es información, no navegación.
 */
export default function DashboardPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const fullName = profile?.full_name ?? profile?.email ?? '';
  const firstName = fullName.split(' ')[0] || fullName;
  const now = new Date();
  const dayLabel = capitalize(format(now, 'EEEE', { locale: es }));
  const longDate = format(now, "d 'de' MMMM 'de' yyyy", { locale: es });

  return (
    <div className="space-y-6 p-8">
      {/* Header con greeting + fecha + CTAs principales */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground">
            {greeting()}, {firstName} · {dayLabel}, {longDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/caja/venta/nueva">
              <Receipt className="mr-2 h-4 w-4" />
              Nueva venta
            </Link>
          </Button>
          <Button asChild>
            <Link to="/reparaciones/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva orden
            </Link>
          </Button>
        </div>
      </header>

      {/* Row 1 — KPI Strip */}
      <KpiStrip />

      {/* Row 2 — Operativa (3 cards) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <TodayAgendaCard />
        <CashTodayCard />
        <LowStockCard />
      </div>

      {/* Row 3-4 — admin only */}
      {isAdmin && (
        <>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OrderStatusBreakdownCard />
            </div>
            <TopProductsCard />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueCard />
            </div>
            <EmployeeSalesCard />
          </div>
        </>
      )}
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
