export interface Sucursal {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Settings extra para tickets/branding (migración 0033). Nullable porque
  // las sucursales viejas no los tienen seteados.
  rfc: string | null;
  email: string | null;
  web: string | null;
  logo_url: string | null;
  warranty_message: string | null;
}

export interface SucursalSetting {
  sucursal_id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface UserSucursalAssignment {
  user_id: string;
  sucursal_id: string;
  created_at: string;
}
