import { useState } from 'react';
import { BarChart3, TrendingUp, Layers, FileText, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import SalesReportPanel from './panels/SalesReportPanel';
import TopProductsPanel from './panels/TopProductsPanel';
import OrderStatusPanel from './panels/OrderStatusPanel';
import MonthlyAccountingPanel from './panels/MonthlyAccountingPanel';
import EmployeeSalesPanel from './panels/EmployeeSalesPanel';

type Tab = 'sales' | 'products' | 'orders' | 'accounting' | 'employees';

const TABS: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'sales', label: 'Ventas por período', icon: BarChart3 },
  { key: 'products', label: 'Top productos', icon: TrendingUp },
  { key: 'employees', label: 'Empleados', icon: UserCheck },
  { key: 'orders', label: 'OS por estado', icon: Layers },
  { key: 'accounting', label: 'Mensual contable', icon: FileText },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">
          Reportes operativos y contables. Cada panel exporta a CSV (o PDF
          el contable).
        </p>
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-card p-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'sales' && <SalesReportPanel />}
      {tab === 'products' && <TopProductsPanel />}
      {tab === 'employees' && <EmployeeSalesPanel />}
      {tab === 'orders' && <OrderStatusPanel />}
      {tab === 'accounting' && <MonthlyAccountingPanel />}
    </div>
  );
}
