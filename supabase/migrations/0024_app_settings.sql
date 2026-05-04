-- =====================================================
-- AlienRepair — Migración 0024
-- Tabla genérica de configuración (app_settings)
-- + seed para multiplicador del catálogo de proveedor
-- Aplicar UNA VEZ en SQL Editor de Supabase. Idempotente.
-- =====================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
drop policy if exists app_settings_admin_write on public.app_settings;

create policy app_settings_read on public.app_settings
  for select using (public.is_active_user());

create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value, description) values
  ('catalog_markup_multiplier', '2.5',
   'Multiplicador del precio de compra para sugerir precio de venta. 2.5 = markup 150%.')
on conflict (key) do nothing;
