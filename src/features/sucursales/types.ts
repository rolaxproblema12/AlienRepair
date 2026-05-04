export interface Sucursal {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSucursalAssignment {
  user_id: string;
  sucursal_id: string;
  created_at: string;
}
