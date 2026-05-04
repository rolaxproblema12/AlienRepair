export type PartCategory =
  | 'placa_centro_carga'
  | 'auricular'
  | 'altavoz'
  | 'flexor'
  | 'logica'
  | 'bateria'
  | 'chasis'
  | 'tapa'
  | 'pantalla'
  | 'huella'
  | 'camara'
  | 'bandeja';

export type PartMovementKind = 'entrada' | 'salida' | 'ajuste';

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  placa_centro_carga: 'Placa de centro de carga',
  auricular: 'Auricular',
  altavoz: 'Altavoz',
  flexor: 'Flexores',
  logica: 'Lógicas',
  bateria: 'Baterías',
  chasis: 'Chasis',
  tapa: 'Tapas',
  pantalla: 'Pantallas',
  huella: 'Huellas',
  camara: 'Cámaras',
  bandeja: 'Bandejas',
};

export const PART_CATEGORIES: PartCategory[] = [
  'placa_centro_carga',
  'auricular',
  'altavoz',
  'flexor',
  'logica',
  'bateria',
  'chasis',
  'tapa',
  'pantalla',
  'huella',
  'camara',
  'bandeja',
];

export const PART_CATEGORY_COLOR: Record<PartCategory, string> = {
  placa_centro_carga: 'bg-cyan-500',
  auricular: 'bg-violet-500',
  altavoz: 'bg-orange-500',
  flexor: 'bg-emerald-500',
  logica: 'bg-rose-500',
  bateria: 'bg-amber-500',
  chasis: 'bg-blue-500',
  tapa: 'bg-zinc-500',
  pantalla: 'bg-fuchsia-500',
  huella: 'bg-teal-500',
  camara: 'bg-yellow-500',
  bandeja: 'bg-slate-500',
};

export interface Part {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: PartCategory;
  cost_purchase: number;
  cost_sale: number;
  stock: number;
  min_stock: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface PartMovement {
  id: string;
  part_id: string;
  kind: PartMovementKind;
  quantity: number;
  unit_purchase_price: number | null;
  unit_sale_price: number | null;
  order_id: string | null;
  sale_id: string | null;
  reason: string | null;
  reference: string | null;
  created_at: string;
  created_by: string | null;
}

export interface PartUsedOnOrder extends PartMovement {
  part: { id: string; name: string; brand: string; model: string } | null;
}

export const MOVEMENT_KIND_LABELS: Record<PartMovementKind, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
};

export const MOVEMENT_KIND_ACCENT: Record<PartMovementKind, string> = {
  entrada: 'bg-emerald-500/15 text-emerald-400',
  salida: 'bg-red-500/15 text-red-400',
  ajuste: 'bg-amber-500/15 text-amber-400',
};

export function partMargin(p: Pick<Part, 'cost_purchase' | 'cost_sale'>): number {
  return Number(p.cost_sale) - Number(p.cost_purchase);
}

export function partMarginPct(p: Pick<Part, 'cost_purchase' | 'cost_sale'>): number {
  const sale = Number(p.cost_sale);
  if (sale <= 0) return 0;
  return ((sale - Number(p.cost_purchase)) / sale) * 100;
}

export function isPartLowStock(p: Pick<Part, 'stock' | 'min_stock'>): boolean {
  if (p.min_stock == null) return false;
  return p.stock <= p.min_stock;
}
