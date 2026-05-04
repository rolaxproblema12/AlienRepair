import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { printDocument } from '@/lib/printing';

interface Props {
  orderId: string;
}

export default function PrintOrderMenu({ orderId }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Orden de servicio</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => printDocument('order', orderId, 'carta')}>
          Carta (letter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printDocument('order', orderId, 'termica')}>
          Térmica 80mm
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Recibo</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => printDocument('receipt', orderId, 'carta')}>
          Carta (letter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printDocument('receipt', orderId, 'termica')}>
          Térmica 80mm
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
