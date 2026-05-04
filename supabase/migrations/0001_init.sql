-- =====================================================
-- AlienRepair — Migración 0001 (inicial)
-- Perfiles + códigos de acceso + RLS + RPC de canje
-- =====================================================

-- Enums base
create type user_role as enum ('admin','usuario');

-- =====================================================
-- profiles (1:1 con auth.users)
-- =====================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  role          user_role not null default 'usuario',
  active        boolean not null default false,
  attempts      integer not null default 0,
  last_attempt  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil aplicativo asociado 1:1 con auth.users';

-- Trigger para crear profile al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger genérico de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================
-- access_codes
-- =====================================================
create table public.access_codes (
  code            text primary key,
  role_to_grant   user_role not null default 'usuario',
  created_by      uuid references public.profiles(id),
  used_by         uuid references public.profiles(id),
  used_at         timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.access_codes is 'Códigos de un solo uso para activar cuentas';

create index access_codes_unused_idx on public.access_codes (used_at) where used_at is null;

-- =====================================================
-- RPC: canjear código de acceso
-- Bloquea tras 5 intentos fallidos en 10 minutos
-- =====================================================
create or replace function public.redeem_access_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code_row public.access_codes%rowtype;
  v_profile public.profiles%rowtype;
  v_window interval := interval '10 minutes';
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_profile from public.profiles where id = v_user_id for update;
  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  -- Reset del contador si pasó la ventana
  if v_profile.last_attempt is null or v_profile.last_attempt < now() - v_window then
    update public.profiles set attempts = 0 where id = v_user_id;
    v_profile.attempts := 0;
  end if;

  if v_profile.attempts >= 5 then
    raise exception 'Demasiados intentos. Espera 10 minutos.';
  end if;

  if v_profile.active then
    return json_build_object('ok', true, 'already_active', true);
  end if;

  select * into v_code_row from public.access_codes
    where code = upper(p_code) for update;

  if not found then
    update public.profiles
      set attempts = attempts + 1, last_attempt = now()
      where id = v_user_id;
    raise exception 'Código inválido';
  end if;

  if v_code_row.used_at is not null then
    update public.profiles
      set attempts = attempts + 1, last_attempt = now()
      where id = v_user_id;
    raise exception 'Código ya utilizado';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    update public.profiles
      set attempts = attempts + 1, last_attempt = now()
      where id = v_user_id;
    raise exception 'Código expirado';
  end if;

  update public.access_codes
    set used_by = v_user_id, used_at = now()
    where code = v_code_row.code;

  update public.profiles
    set active = true,
        role = v_code_row.role_to_grant,
        attempts = 0,
        last_attempt = null
    where id = v_user_id;

  return json_build_object('ok', true, 'role', v_code_row.role_to_grant);
end;
$$;

grant execute on function public.redeem_access_code(text) to authenticated;

-- =====================================================
-- Helper: ¿es admin?
-- =====================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- =====================================================
-- RLS: profiles
-- =====================================================
alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_select_admin
  on public.profiles for select
  using (public.is_admin());

create policy profiles_update_admin
  on public.profiles for update
  using (public.is_admin());

create policy profiles_update_own_limited
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================
-- RLS: access_codes (solo admin)
-- =====================================================
alter table public.access_codes enable row level security;

create policy access_codes_admin_all
  on public.access_codes for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- Nota para el primer admin:
-- Tras tu primer login con Google, ejecuta manualmente en Supabase SQL editor:
--
--   update public.profiles
--     set role = 'admin', active = true
--     where email = 'TU_EMAIL@gmail.com';
--
-- A partir de ahí, desde la app podrás generar códigos para otros usuarios.
-- =====================================================
