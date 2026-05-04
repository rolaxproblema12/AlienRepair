export type MovementKind = 'entrada' | 'salida' | 'ajuste';

export interface ProductCategory {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  cost_price: number;
  sale_price: number;
  iva_rate: number;
  stock: number;
  min_stock: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ProductWithCategory extends Product {
  category: { id: string; name: string; color: string | null } | null;
}

export interface ProductMovement {
  id: string;
  product_id: string;
  kind: MovementKind;
  quantity: number;
  unit_sale_price: number | null;
  unit_cost_price: number | null;
  reason: string | null;
  reference: string | null;
  created_at: string;
  created_by: string | null;
}

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
};

export const MOVEMENT_KIND_ACCENT: Record<MovementKind, string> = {
  entrada: 'bg-emerald-500/15 text-emerald-400',
  salida: 'bg-red-500/15 text-red-400',
  ajuste: 'bg-amber-500/15 text-amber-400',
};

export function marginAmount(p: Pick<Product, 'cost_price' | 'sale_price'>): number {
  return Number(p.sale_price) - Number(p.cost_price);
}

export function marginPct(p: Pick<Product, 'cost_price' | 'sale_price'>): number {
  const sale = Number(p.sale_price);
  if (sale <= 0) return 0;
  return ((sale - Number(p.cost_price)) / sale) * 100;
}

export function isLowStock(p: Pick<Product, 'stock' | 'min_stock'>): boolean {
  if (p.min_stock == null) return false;
  return p.stock <= p.min_stock;
}
