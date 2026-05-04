import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
}

export default function KpiCard({ label, value, icon: Icon, hint, tone = 'default' }: Props) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight',
              tone === 'positive' && 'text-emerald-400',
              tone === 'negative' && 'text-destructive'
            )}
          >
            {value}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
