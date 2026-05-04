-- =====================================================
-- Migración 0026: Soporte multi-sucursal (foundation)
--
-- Crea las tablas `sucursales` y `user_sucursales`, los
-- helpers RLS para verificar acceso, y siembra una
-- sucursal default ("Casa Matriz") con los usuarios
-- activos existentes asignados.
--
-- Esta migración NO toca tablas transaccionales todavía
-- (orders, products, etc). Eso lo hace 0027.
-- =====================================================

-- =====================================================
-- Tabla sucursales
-- =====================================================
create table public.sucursales (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{2,4}$'),
  name        text not null,
  address     text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.sucursales is
  'Sucursales/locales. El campo `code` (2-4 chars uppercase) se usa como prefijo de folios.';

create trigger sucursales_set_updated_at
  before update on public.sucursales
  for each row execute function public.set_updated_at();

-- =====================================================
-- Asignación N:N usuario ↔ sucursal
-- =====================================================
create table public.user_sucursales (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, sucursal_id)
);

comment on table public.user_sucursales is
  'Sucursales que cada usuario puede operar. Admin no necesita estar aquí — RLS lo deja pasar siempre.';

create index user_sucursales_user_idx on public.user_sucursales(user_id);
create index user_sucursales_sucursal_idx on public.user_sucursales(sucursal_id);

-- =====================================================
-- Helpers RLS
-- =====================================================

-- ¿El usuario actual puede acceder a esta sucursal? (admin o asignación explícita)
create or replace function public.user_can_access_sucursal(p_sucursal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or exists (
           select 1 from public.user_sucursales us
            where us.user_id = auth.uid()
              and us.sucursal_id = p_sucursal_id
         );
$$;

-- Combinador: usuario activo + acceso a la sucursal del row.
-- Esta es la función que las policies de tablas transaccionales van a usar
-- (en 0029) para reemplazar el check antiguo `is_active_user()`.
create or replace function public.is_active_user_in_sucursal(p_sucursal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user()
     and public.user_can_access_sucursal(p_sucursal_id);
$$;

-- =====================================================
-- RLS: sucursales
-- =====================================================
alter table public.sucursales enable row level security;

-- Cualquier usuario activo lee las sucursales que puede operar.
-- Admin lee todas (vía user_can_access_sucursal que ya considera is_admin()).
create policy sucursales_read on public.sucursales
  for select
  using (public.is_active_user() and public.user_can_access_sucursal(id));

-- Solo admin crea/edita/elimina sucursales.
create policy sucursales_admin_write on public.sucursales
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- RLS: user_sucursales
-- =====================================================
alter table public.user_sucursales enable row level security;

-- Cada usuario lee sus propias asignaciones; admin lee todo.
create policy us_read on public.user_sucursales
  for select
  using (auth.uid() = user_id or public.is_admin());

-- Solo admin asigna/desasigna.
create policy us_admin_write on public.user_sucursales
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- Bootstrap: Casa Matriz como sucursal default
-- =====================================================
insert into public.sucursales (code, name)
  values ('CM', 'Casa Matriz')
  on conflict (code) do nothing;

-- Asignar todos los usuarios activos existentes a Casa Matriz.
-- Admin no necesita estar aquí (RLS lo deja pasar igual), pero lo añadimos
-- para que aparezca en su dropdown de selector con la lista filtrada.
insert into public.user_sucursales (user_id, sucursal_id)
select p.id, (select id from public.sucursales where code = 'CM')
  from public.profiles p
 where p.active = true
  on conflict do nothing;

-- =====================================================
-- Grants para SECURITY DEFINER helpers
-- =====================================================
grant execute on function public.user_can_access_sucursal(uuid) to authenticated;
grant execute on function public.is_active_user_in_sucursal(uuid) to authenticated;
