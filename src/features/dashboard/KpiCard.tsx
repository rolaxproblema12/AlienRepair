import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type KpiTone = 'neutral' | 'success' | 'warning' | 'destructive';

const TONE_CLASSES: Record<KpiTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  destructive: 'text-destructive',
};

interface Props {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Texto chico debajo del valor (ej: "$1,500 hoy" o "Cerrada desde 18:30") */
  subLabel?: React.ReactNode;
  tone?: KpiTone;
  /** Ruta a la que linkea el card. Si no, no se muestra como link. */
  to?: string;
  loading?: boolean;
}

/**
 * Mini-card del KPI Strip del dashboard. Alto fijo (~96px) para que la row
 * de 4 quede pareja. Soporta link opcional al detalle (ej: "OS retrasadas"
 * → /retrasados).
 */
export default function KpiCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone = 'neutral',
  to,
  loading,
}: Props) {
  const content = (
    <CardContent className="flex h-full items-center gap-3 p-4">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary/60',
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-20" />
        ) : (
          <p className={cn('truncate text-xl font-semibold tabular-nums', TONE_CLASSES[tone])}>
            {value}
          </p>
        )}
        {subLabel && !loading && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subLabel}</p>
        )}
      </div>
    </CardContent>
  );

  const cardClass = cn(
    'h-24 transition',
    to && 'hover:border-primary/40 hover:shadow-sm',
  );

  if (to) {
    return (
      <Link to={to}>
        <Card className={cardClass}>{content}</Card>
      </Link>
    );
  }
  return <Card className={cardClass}>{content}</Card>;
}
