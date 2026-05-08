import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrder } from '../hooks';
import OrderLabel from '@/components/print/OrderLabel';

export default function PrintOrderLabelPage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);

  // Notificamos `print-ready` tanto en éxito como en error para que el main
  // process imprima lo que haya en lugar de esperar el timeout de 5s.
  const ready = !order.isLoading && (order.data !== undefined || order.isError);

  useEffect(() => {
    if (!ready) return;
    document.body.classList.add('print-label-page');
    requestAnimationFrame(() => {
      window.alien?.notifyPrintReady?.();
    });
    return () => {
      document.body.classList.remove('print-label-page');
    };
  }, [ready]);

  if (order.isLoading) {
    return <div className="p-8 text-center">Cargando etiqueta...</div>;
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
      <OrderLabel order={order.data} />
    </div>
  );
}
