import { TrendingUp } from 'lucide-react';
import { useInventoryUtility } from './hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { currency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  from: string;
  to: string;
}

export default function InventoryUtilityCard({ from, to }: Props) {
  const utilQ = useInventoryUtility(from, to);
  const top = utilQ.data?.byProduct.slice(0, 5) ?? [];
  const total = utilQ.data?.total ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Utilidad del inventario</CardTitle>
          <CardDescription>
            Ganancia por ventas registradas en inventario en el rango.
          </CardDescription>
        </div>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {utilQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <p
              className={cn(
                'text-3xl font-bold tracking-tight',
                total >= 0 ? 'text-emerald-400' : 'text-destructive',
              )}
            >
              {currency(total)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {utilQ.data?.byProduct.length ?? 0} producto(s) con ventas registradas
            </p>

            {top.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Top 5 por utilidad
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top.map((row) => (
                      <TableRow key={row.product_id}>
                        <TableCell className="text-sm">
                          <div className="line-clamp-1 font-medium">
                            {row.product_name}
                          </div>
                          {row.category_name && (
                            <div className="text-xs text-muted-foreground">
                              {row.category_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.units_sold}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {currency(row.utility_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Sin ventas registradas en el rango. Las salidas de inventario se cuentan
                como ventas.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
