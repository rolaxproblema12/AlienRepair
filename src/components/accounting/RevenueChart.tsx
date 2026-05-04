import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AccountingDailyRow } from '@/features/accounting/types';
import { formatShortDate } from '@/lib/dates';
import { currency } from '@/lib/format';

interface Props {
  data: AccountingDailyRow[];
}

export default function RevenueChart({ data }: Props) {
  const rows = data.map((r) => ({
    dia: r.dia,
    label: formatShortDate(r.dia),
    ingresos: Number(r.ingresos_total),
    gastos: Number(r.gastos_total),
    ganancia: Number(r.ganancia),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(173 80% 40%)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="hsl(173 80% 40%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(0 0% 65%)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(0 0% 65%)' }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(0 0% 10%)',
              border: '1px solid hsl(0 0% 20%)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => currency(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="hsl(173 80% 40%)"
            fill="url(#inc)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="gastos"
            name="Gastos"
            stroke="hsl(0 72% 51%)"
            fill="url(#gas)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
