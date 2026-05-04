import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Plus } from 'lucide-react';
import { usePartsUsedOnOrder } from './hooks';
import AddPartToOrderDialog from './AddPartToOrderDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { currency } from '@/lib/format';

interface Props {
  orderId: string;
}

export default function OrderPartsSection({ orderId }: Props) {
  const partsQ = usePartsUsedOnOrder(orderId);
  const [addOpen, setAddOpen] = useState(false);

  const total = (partsQ.data ?? []).reduce(
    (sum, m) => sum + Math.abs(m.quantity) * Number(m.unit_sale_price ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Piezas usadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Total: <strong>{currency(total)}</strong> (se suma al saldo de la orden)
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar pieza
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {partsQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !partsQ.data?.length ? (
          <div className="flex flex-col items-center gap-2 px-6 pb-6 text-center text-muted-foreground">
            <Cpu className="h-6 w-6" />
            <p className="text-sm">Aún no se han usado piezas en esta orden.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Pieza</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="pr-6 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partsQ.data.map((m) => {
                const qty = Math.abs(m.quantity);
                const lineTotal = qty * Number(m.unit_sale_price ?? 0);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6">
                      {m.part ? (
                        <Link
                          to={`/piezas/${m.part.id}`}
                          className="font-medium hover:underline"
                        >
                          {m.part.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Pieza eliminada</span>
                      )}
                      {m.part && (
                        <div className="text-xs text-muted-foreground">
                          {m.part.brand} · {m.part.model}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{qty}</TableCell>
                    <TableCell className="text-right text-sm">
                      {currency(m.unit_sale_price ?? 0)}
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm font-medium">
                      {currency(lineTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddPartToOrderDialog open={addOpen} onOpenChange={setAddOpen} orderId={orderId} />
    </Card>
  );
}
