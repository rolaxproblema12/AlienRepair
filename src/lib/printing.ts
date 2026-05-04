import { toast } from 'sonner';
import { getErrorMessage } from './errors';

export type PrintKind = 'order' | 'receipt' | 'sale';
export type PrintSize = 'carta' | 'termica';

export async function printDocument(kind: PrintKind, id: string, size: PrintSize) {
  const route = `/print/${kind}/${id}?size=${size}`;
  try {
    await window.alien.printDocument(route);
  } catch (err) {
    const message = getErrorMessage(err) || 'Error al imprimir';
    if (!/cancel/i.test(message)) {
      toast.error(message);
    }
  }
}
