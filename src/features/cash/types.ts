export type CashSessionStatus = 'open' | 'closed';
export type SaleStatus = 'completada' | 'cancelada';
export type SalePaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';
export type SaleItemKind = 'producto' | 'abono_orden';

export interface CashSession {
  id: string;
  status: CashSessionStatus;
  opened_at: string;
  opened_by: string | null;
  opening_amount: number;
  closed_at: string | null;
  closed_by: string | null;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  closing_notes: string | null;
}

export interface Sale {
  id: string;
  folio: string;
  cash_session_id: string;
  customer_id: string | null;
  subtotal: number;
  iva_total: number;
  discount_total: number;
  total: number;
  payment_method: SalePaymentMethod;
  notes: string | null;
  status: SaleStatus;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SaleWithCustomer extends Sale {
  customer: { id: string; name: string; phone: string } | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  kind: SaleItemKind;
  product_id: string | null;
  order_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  iva_rate: number;
  discount: number;
  line_total: number;
}

export interface SaleDetail extends SaleWithCustomer {
  items: SaleItem[];
}

export interface OrderPayment {
  id: string;
  order_id: string;
  sale_id: string | null;
  cash_session_id: string | null;
  amount: number;
  payment_method: SalePaymentMethod;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface OrderBalance {
  order_id: string;
  base_cost: number;
  parts_total: number;
  total: number;
  paid: number;
  balance: number;
}

export const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export const PAYMENT_METHOD_ACCENT: Record<SalePaymentMethod, string> = {
  efectivo: 'bg-emerald-500/15 text-emerald-400',
  tarjeta: 'bg-violet-500/15 text-violet-400',
  transferencia: 'bg-cyan-500/15 text-cyan-400',
};

// Línea de carrito en memoria (antes de persistir)
export interface CartLine {
  /** uuid local generado en cliente */
  key: string;
  kind: SaleItemKind;
  product_id: string | null;
  order_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  iva_rate: number;
  discount: number;
  /** Stock disponible (solo para validación visual) */
  stock_available?: number;
  /** Folio o referencia de la orden si es abono */
  reference_label?: string;
}

export function calcLineTotal(line: CartLine): number {
  const gross = line.quantity * line.unit_price - line.discount;
  return Math.max(0, gross);
}
