import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOrder } from '../hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import ReceiptTemplate from '@/components/print/ReceiptTemplate';

export default function PrintReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const variant = (params.get('size') === 'termica' ? 'termica' : 'carta') as
    | 'carta'
    | 'termica';

  const order = useOrder(id);
  const { current: sucursal } = useCurrentSucursal();

  // Notificamos `print-ready` tanto en éxito como en error para que el main
  // process imprima lo que haya en lugar de esperar el timeout de 5s.
  const ready = !order.isLoading && (order.data !== undefined || order.isError);

  useEffect(() => {
    if (!ready) return;
    document.body.classList.add(
      variant === 'carta' ? 'print-carta-page' : 'print-termica-page',
    );
    requestAnimationFrame(() => {
      window.alien?.notifyPrintReady?.();
    });
    return () => {
      document.body.classList.remove('print-carta-page', 'print-termica-page');
    };
  }, [ready, variant]);

  if (order.isLoading) {
    return <div className="p-8 text-center">Cargando recibo...</div>;
  }
  if (order.isError) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Error cargando la orden. Cierra esta ventana y vuelve a intentarlo.
      </div>
    );
  }
  if (!order.data) {
    return <div className="p-8 text-center">Orden no encontrada.</div>;
  }

  return (
    <div className="print-root">
      <ReceiptTemplate order={order.data} variant={variant} sucursal={sucursal} />
    </div>
  );
}
