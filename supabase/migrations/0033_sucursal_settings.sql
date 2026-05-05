-- =====================================================
-- AlienRepair — Migración 0033
-- Settings extra por sucursal (datos para tickets/whatsapp/branding)
--
-- Aplicar con `npm run db:migrate`. Idempotente.
-- =====================================================

-- 1. Columnas extra en sucursales (datos del shop que aparecen en tickets,
--    facturas y mensajes WhatsApp).
alter table public.sucursales
  add column if not exists rfc text,
  add column if not exists email text,
  add column if not exists web text,
  add column if not exists logo_url text,
  add column if not exists warranty_message text;

-- 2. Tabla key/value de plantillas y settings dinámicos por sucursal.
--    Se usa para mensajes WhatsApp por status (key = 'msg_status_listo'),
--    y cualquier otro setting que en el futuro varíe por sucursal sin
--    requerir alter table.
create table if not exists public.sucursal_settings (
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  key         text not null,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  primary key (sucursal_id, key)
);

create index if not exists sucursal_settings_key_idx
  on public.sucursal_settings(key);

drop trigger if exists sucursal_settings_set_updated_at on public.sucursal_settings;
create trigger sucursal_settings_set_updated_at
  before update on public.sucursal_settings
  for each row execute function public.set_updated_at();

-- 3. RLS
alter table public.sucursal_settings enable row level security;

drop policy if exists sucursal_settings_read on public.sucursal_settings;
drop policy if exists sucursal_settings_admin_write on public.sucursal_settings;

-- Lectura: cualquier user activo de la sucursal puede leer (templates
-- WhatsApp se usan en el front del operador).
create policy sucursal_settings_read on public.sucursal_settings
  for select using (public.is_active_user_in_sucursal(sucursal_id));

-- Escritura: solo admin (mismo patrón que app_settings).
create policy sucursal_settings_admin_write on public.sucursal_settings
  for all using (public.is_admin())
  with check (public.is_admin());
