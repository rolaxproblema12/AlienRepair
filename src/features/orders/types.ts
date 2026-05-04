export type DeviceType =
  | 'celular'
  | 'tablet'
  | 'computadora'
  | 'bocina'
  | 'tv'
  | 'consola'
  | 'otro';

export type OrderStatus = 'pendiente' | 'en_espera' | 'reparando' | 'listo' | 'entregado';
export type OrderKind = 'reparacion' | 'encargo' | 'accesorio';

export interface Order {
  id: string;
  folio: string;
  customer_id: string;
  kind: OrderKind;
  device_type: DeviceType | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  problem: string | null;
  item_description: string | null;
  device_password: string | null;
  cost: number;
  down_payment: number;
  status: OrderStatus;
  received_at: string;
  estimated_delivery: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithCustomer extends Order {
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  celular: 'Celular',
  tablet: 'Tablet',
  computadora: 'Computadora',
  bocina: 'Bocina',
  tv: 'Televisión',
  consola: 'Consola',
  otro: 'Otro',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  en_espera: 'En espera',
  reparando: 'Reparando',
  listo: 'Listo',
  entregado: 'Entregado',
};

export const STATUS_KANBAN_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Recibido',
  en_espera: 'Diagnóstico',
  reparando: 'Reparación',
  listo: 'Listo',
  entregado: 'Entregado',
};

export const STATUS_ACCENT: Record<OrderStatus, string> = {
  pendiente: 'bg-cyan-500',
  en_espera: 'bg-violet-500',
  reparando: 'bg-orange-500',
  listo: 'bg-emerald-500',
  entregado: 'bg-zinc-500',
};

export const KIND_LABELS: Record<OrderKind, string> = {
  reparacion: 'Reparación',
  encargo: 'Encargo',
  accesorio: 'Accesorio',
};

export const ORDER_STATUSES: OrderStatus[] = [
  'pendiente',
  'en_espera',
  'reparando',
  'listo',
  'entregado',
];

export const ITEM_STATUSES: OrderStatus[] = ['pendiente', 'entregado'];

export function availableStatusesFor(kind: OrderKind): OrderStatus[] {
  return kind === 'reparacion' ? ORDER_STATUSES : ITEM_STATUSES;
}

export const DEVICE_TYPES_WITH_PASSWORD: DeviceType[] = ['celular', 'tablet', 'computadora'];

export function supportsDevicePassword(t?: DeviceType | null): boolean {
  return !!t && DEVICE_TYPES_WITH_PASSWORD.includes(t);
}
