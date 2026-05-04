import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSale } from './hooks';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import SaleTicket from '@/components/print/SaleTicket';

export default function PrintSalePage() {
  const { id } = useParams<{ id: string }>();
  const sale = useSale(id);
  const { current: sucursal } = useCurrentSucursal();

  useEffect(() => {
    if (sale.data) {
      document.body.classList.add('print-termica-page');
      requestAnimationFrame(() => {
        window.alien?.notifyPrintReady?.();
      });
    }
    return () => {
      document.body.classList.remove('print-termica-page');
    };
  }, [sale.data]);

  if (sale.isLoading) {
    return <div className="p-8 text-center">Cargando ticket...</div>;
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
