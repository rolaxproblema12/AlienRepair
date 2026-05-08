import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSale } from './hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import SaleTicket from '@/components/print/SaleTicket';

export default function PrintSalePage() {
  const { id } = useParams<{ id: string }>();
  const sale = useSale(id);
  const { current: sucursal } = useCurrentSucursal();

  // Notificamos `print-ready` tanto en éxito como en error para que el main
  // process imprima lo que haya en lugar de esperar el timeout de 5s.
  const ready = !sale.isLoading && (sale.data !== undefined || sale.isError);

  useEffect(() => {
    if (!ready) return;
    document.body.classList.add('print-termica-page');
    requestAnimationFrame(() => {
      window.alien?.notifyPrintReady?.();
    });
    return () => {
      document.body.classList.remove('print-termica-page');
    };
  }, [ready]);

  if (sale.isLoading) {
    return <div className="p-8 text-center">Cargando ticket...</div>;
  }
  if (sale.isError) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Error cargando la venta. Cierra esta ventana y vuelve a intentarlo.
      </div>
    );
  }
  if (!sale.data) {
    return <div className="p-8 text-center">Venta no encontrada.</div>;
  }

  return (
    <div className="print-root">
      <SaleTicket sale={sale.data} sucursal={sucursal} />
    </div>
  );
}
