export type ExpenseKind = 'refaccion' | 'general';

export interface Expense {
  id: string;
  kind: ExpenseKind;
  order_id: string | null;
  description: string;
  amount: number;
  spent_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithOrder extends Expense {
  order: {
    id: string;
    folio: string;
    kind: 'reparacion' | 'encargo' | 'accesorio';
  } | null;
}

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  refaccion: 'Refacción',
  general: 'General',
};

export interface AccountingDailyRow {
  dia: string;
  ingresos_reparacion: number;
  ingresos_encargo: number;
  ingresos_accesorio: number;
  ingresos_total: number;
  gastos_refaccion: number;
  gastos_general: number;
  gastos_total: number;
  ganancia: number;
}
