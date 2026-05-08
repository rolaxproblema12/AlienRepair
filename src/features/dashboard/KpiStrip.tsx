import { AlertTriangle, BadgeCheck, Package, Wallet } from 'lucide-react';
import { useOverdueOrdersCount, useWarrantyOrders } from '@/features/orders/hooks';
import { useCurrentSession, useDayBalance } from '@/features/cash/hooks';
import { useProducts } from '@/features/inventory/hooks';
import { useParts } from '@/features/parts/hooks';
import { currency } from '@/lib/format';
import KpiCard from './KpiCard';

/**
 * 4 mini-cards del above-the-fold del dashboard, siempre visibles para
 * todos los roles. Responde de un vistazo: ¿caja? ¿retrasadas? ¿garantías?
 * ¿stock?
 */
export default function KpiStrip() {
  const session = useCurrentSession();
  const dayBalance = useDayBalance(session.data ?? null);
  const overdue = useOverdueOrdersCount();
  const warranties = useWarrantyOrders({ status: 'activas' });
  const lowStockProducts = useProducts({ lowStock: true });
  const lowStockParts = useParts({ lowStock: true });

  // Caja del día — KPI tone depende del estado.
  const sessionOpen = !!session.data;
  const cashTotal = dayBalance.data?.totalSales ?? 0;
  const cashTone = sessionOpen ? 'success' : 'neutral';
  const cashValue = sessionOpen ? currency(cashTotal) : 'Cerrada';
  const cashSub = sessionOpen
    ? `${dayBalance.data?.salesCount ?? 0} ventas hoy`
    : 'Abrir desde Caja';

  // OS retrasadas — destructive si > 0, success si 0.
  const overdueCount = overdue.data ?? 0;
  const overdueTone = overdueCount > 0 ? 'destructive' : 'success';
  const overdueValue = overdueCount > 0 ? overdueCount.toString() : 'Al día';
  const overdueSub = overdueCount > 0 ? 'Revisá retrasados' : 'Sin entregas vencidas';

  // Garantías activas — warning si > 0.
  const warrantyCount = warranties.data?.length ?? 0;
  const warrantyTone = warrantyCount > 0 ? 'warning' : 'neutral';
  const warrantyValue = warrantyCount.toString();
  const warrantySub = warrantyCount === 1 ? 'reclamo abierto' : 'reclamos abiertos';

  // Stock crítico — combina productos + piezas. Tone escalado.
  const lowStockCount =
    (lowStockProducts.data?.length ?? 0) + (lowStockParts.data?.length ?? 0);
  const lowStockTone =
    lowStockCount > 5 ? 'destructive' : lowStockCount > 0 ? 'warning' : 'neutral';
  const lowStockValue = lowStockCount.toString();
  const lowStockSub =
    lowStockCount > 0 ? 'Items bajo el mínimo' : 'Inventario OK';

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={Wallet}
        label="Caja del día"
        value={cashValue}
        subLabel={cashSub}
        tone={cashTone}
        to="/caja"
        loading={session.isLoading || dayBalance.isLoading}
      />
      <KpiCard
        icon={AlertTriangle}
        label="OS retrasadas"
        value={overdueValue}
        subLabel={overdueSub}
        tone={overdueTone}
        to={overdueCount > 0 ? '/retrasados' : undefined}
        loading={overdue.isLoading}
      />
      <KpiCard
        icon={BadgeCheck}
        label="Garantías activas"
        value={warrantyValue}
        subLabel={warrantySub}
        tone={warrantyTone}
        to="/garantias"
        loading={warranties.isLoading}
      />
      <KpiCard
        icon={Package}
        label="Stock crítico"
        value={lowStockValue}
        subLabel={lowStockSub}
        tone={lowStockTone}
        to="/inventario"
        loading={lowStockProducts.isLoading || lowStockParts.isLoading}
      />
    </div>
  );
}
