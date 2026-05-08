import { FileText, Printer, Receipt, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { printDocument } from '@/lib/printing';

interface Props {
  orderId: string;
}

/**
 * Tres acciones de impresión por OS, sin sub-elección de tamaño:
 *  - Orden completa → carta (hoja firma cliente, descripción detallada).
 *  - Recibo de pago → térmica 80mm (comprobante chico de abonos).
 *  - Etiqueta       → térmica 80mm × 40mm (folio + cliente, va en el equipo).
 *
 * Cada documento tiene su tamaño fijo según el use case del taller —
 * antes el menú daba 4 opciones (carta/térmica × orden/recibo) que era
 * ruido innecesario y propenso a error humano.
 */
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
        <DropdownMenuItem onClick={() => printDocument('order', orderId, 'carta')}>
          <FileText className="mr-2 h-4 w-4" />
          Orden (carta)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printDocument('receipt', orderId, 'termica')}>
          <Receipt className="mr-2 h-4 w-4" />
          Recibo (térmica)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => printDocument('order-label', orderId, 'termica')}>
          <Tag className="mr-2 h-4 w-4" />
          Etiqueta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
