export type DeviceType =
  | 'celular'
  | 'tablet'
  | 'computadora'
  | 'bocina'
  | 'tv'
  | 'consola'
  | 'otro';

export type OrderStatus =
  | 'pendiente'
  | 'diagnostico'
  | 'en_espera'
  | 'reparando'
  | 'listo'
  | 'entregado';
export type OrderKind = 'reparacion' | 'encargo' | 'accesorio';

export type IntakeChecklistItemStatus = 'ok' | 'falla' | 'nc';
export type IntakeChecklistReason = 'apagado' | 'mojado' | 'sin_codigo' | 'otro';

export interface IntakeChecklistData {
  bateria_porcentaje: number | null;
  pantalla: IntakeChecklistItemStatus;
  touch: IntakeChecklistItemStatus;
  camara_trasera: IntakeChecklistItemStatus;
  camara_frontal: IntakeChecklistItemStatus;
  bocina: IntakeChecklistItemStatus;
  microfono: IntakeChecklistItemStatus;
  wifi: IntakeChecklistItemStatus;
  bluetooth: IntakeChecklistItemStatus;
  senal_celular: IntakeChecklistItemStatus;
  carga: IntakeChecklistItemStatus;
  bateria_estado: IntakeChecklistItemStatus;
  botones_laterales: IntakeChecklistItemStatus;
  estetica: IntakeChecklistItemStatus;
  tapa_trasera: IntakeChecklistItemStatus;
  trae_funda: boolean;
}

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
  /** Si es reclamo de garantía, apunta a la OS original entregada (id). */
  warranty_claim_of: string | null;
  diagnosis: string | null;
  intake_checklist_applies: boolean | null;
  intake_checklist_reason: IntakeChecklistReason | null;
  intake_checklist_reason_other: string | null;
  intake_checklist: IntakeChecklistData | null;
  warranty_void: boolean;
  warranty_void_reason: string | null;
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
  diagnostico: 'Diagnóstico',
  en_espera: 'En espera',
  reparando: 'Reparando',
  listo: 'Listo',
  entregado: 'Entregado',
};

export const STATUS_KANBAN_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Recibido',
  diagnostico: 'Diagnóstico',
  en_espera: 'En espera',
  reparando: 'Reparación',
  listo: 'Listo',
  entregado: 'Entregado',
};

export const STATUS_ACCENT: Record<OrderStatus, string> = {
  pendiente: 'bg-cyan-500',
  diagnostico: 'bg-violet-500',
  en_espera: 'bg-amber-500',
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
  'diagnostico',
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

export const INTAKE_CHECKLIST_REASON_LABELS: Record<IntakeChecklistReason, string> = {
  apagado: 'Apagado / No enciende',
  mojado: 'Mojado',
  sin_codigo: 'Sin código de desbloqueo',
  otro: 'Otro',
};

export const INTAKE_CHECKLIST_STATUS_LABELS: Record<IntakeChecklistItemStatus, string> = {
  ok: 'OK',
  falla: 'Falla',
  nc: 'N/C',
};

export type IntakeChecklistItemKey = Exclude<
  keyof IntakeChecklistData,
  'bateria_porcentaje' | 'trae_funda'
>;

export const INTAKE_CHECKLIST_ITEMS: { key: IntakeChecklistItemKey; label: string }[] = [
  { key: 'pantalla', label: 'Pantalla' },
  { key: 'touch', label: 'Touch' },
  { key: 'camara_trasera', label: 'Cámara trasera' },
  { key: 'camara_frontal', label: 'Cámara frontal' },
  { key: 'bocina', label: 'Bocina' },
  { key: 'microfono', label: 'Micrófono' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'bluetooth', label: 'Bluetooth' },
  { key: 'senal_celular', label: 'Señal celular' },
  { key: 'carga', label: 'Carga' },
  { key: 'bateria_estado', label: 'Estado de batería' },
  { key: 'botones_laterales', label: 'Botones laterales' },
  { key: 'estetica', label: 'Estética' },
  { key: 'tapa_trasera', label: 'Tapa trasera' },
];

export const INTAKE_CHECKLIST_GROUPS: {
  title: string;
  icon: string;
  items: IntakeChecklistItemKey[];
}[] = [
  { title: 'Pantalla y touch', icon: '📱', items: ['pantalla', 'touch'] },
  { title: 'Cámaras', icon: '📷', items: ['camara_trasera', 'camara_frontal'] },
  { title: 'Audio', icon: '🔊', items: ['bocina', 'microfono'] },
  { title: 'Conectividad', icon: '📶', items: ['wifi', 'bluetooth', 'senal_celular'] },
  { title: 'Carga y batería', icon: '⚡', items: ['carga', 'bateria_estado'] },
  { title: 'Físico', icon: '📦', items: ['botones_laterales', 'estetica', 'tapa_trasera'] },
];

export const WARRANTY_VOIDING_REASONS: IntakeChecklistReason[] = ['mojado', 'sin_codigo'];

export function defaultIntakeChecklist(): IntakeChecklistData {
  return {
    bateria_porcentaje: null,
    pantalla: 'nc',
    touch: 'nc',
    camara_trasera: 'nc',
    camara_frontal: 'nc',
    bocina: 'nc',
    microfono: 'nc',
    wifi: 'nc',
    bluetooth: 'nc',
    senal_celular: 'nc',
    carga: 'nc',
    bateria_estado: 'nc',
    botones_laterales: 'nc',
    estetica: 'nc',
    tapa_trasera: 'nc',
    trae_funda: false,
  };
}
