-- =====================================================
-- Migración 0028: Folios por sucursal con prefijo
--
-- Convierte orders.folio (bigint identity) y sales.folio (integer seq)
-- en columnas text generadas por sucursal con formato `<CODE>-<NNNN>`.
--
-- Folios históricos existentes se preservan como texto numérico ('1', '2'...).
-- Nuevos folios usan el formato con prefijo.
-- =====================================================

-- =====================================================
-- Tabla de contadores por sucursal+kind
-- =====================================================
create table public.sucursal_counters (
  sucursal_id uuid not null references public.sucursales(id) on delete cascade,
  kind        text not null check (kind in ('order','sale')),
  current     integer not null default 0,
  primary key (sucursal_id, kind)
);

comment on table public.sucursal_counters is
  'Contador autoincremental de folios por sucursal y tipo de documento (order|sale). Acceso solo vía next_folio() — SECURITY DEFINER bypasa RLS.';

-- RLS: ningún cliente puede leer/escribir directamente. La función
-- public.next_folio() es SECURITY DEFINER y corre como owner, así que sigue
-- pudiendo actualizar el contador. Deshabilitamos todo acceso para que un
-- operador comprometido no pueda manipular folios desde el front.
alter table public.sucursal_counters enable row level security;
-- (sin policies = todo bloqueado para authenticated/anon)

-- =====================================================
-- Función: next_folio(sucursal_id, kind)
-- Devuelve el próximo folio formateado, ej: 'CM-0042'
-- =====================================================
create or replace function public.next_folio(p_sucursal uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_n integer;
begin
  select code into v_code from public.sucursales where id = p_sucursal;
  if v_code is null then
    raise exception 'Sucursal no existe: %', p_sucursal;
  end if;

  insert into public.sucursal_counters (sucursal_id, kind, current)
       values (p_sucursal, p_kind, 1)
  on conflict (sucursal_id, kind)
       do update set current = sucursal_counters.current + 1
  returning current into v_n;

  return v_code || '-' || lpad(v_n::text, 4, '0');
end;
$$;

grant execute on function public.next_folio(uuid, text) to authenticated;

-- =====================================================
-- orders.folio: bigint identity → text
-- =====================================================
-- Identity columns no se pueden alterar directamente; hay que dropear y
-- recrear. Hacemos el cast preservando los valores existentes.
alter table public.orders alter column folio drop identity if exists;
alter table public.orders alter column folio drop default;
alter table public.orders alter column folio type text using folio::text;

-- Inicializar contador para Casa Matriz con el max actual.
-- Asumimos que todos los folios viejos eran de Casa Matriz (vía backfill 0027).
insert into public.sucursal_counters (sucursal_id, kind, current)
select sucursal_id,
       'order',
       coalesce(max(coalesce(nullif(regexp_replace(folio,'[^0-9]','','g'),''),'0')::int), 0)
  from public.orders
 group by sucursal_id
on conflict (sucursal_id, kind) do update set current = excluded.current;

-- Trigger: si folio viene null en INSERT, generarlo
create or replace function public.orders_set_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null then
    new.folio := public.next_folio(new.sucursal_id, 'order');
  end if;
  return new;
end;
$$;

create trigger orders_set_folio_trg
  before insert on public.orders
  for each row execute function public.orders_set_folio();

-- =====================================================
-- sales.folio: integer seq → text
-- =====================================================
alter table public.sales alter column folio drop default;
alter table public.sales alter column folio type text using folio::text;
drop sequence if exists public.sales_folio_seq;

insert into public.sucursal_counters (sucursal_id, kind, current)
select sucursal_id,
       'sale',
       coalesce(max(coalesce(nullif(regexp_replace(folio,'[^0-9]','','g'),''),'0')::int), 0)
  from public.sales
 group by sucursal_id
on conflict (sucursal_id, kind) do update set current = excluded.current;

create or replace function public.sales_set_folio()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null then
    new.folio := public.next_folio(new.sucursal_id, 'sale');
  end if;
  return new;
end;
$$;

create trigger sales_set_folio_trg
  before insert on public.sales
  for each row execute function public.sales_set_folio();

-- =====================================================
-- Adaptar funciones existentes que referencian folio numérico
-- =====================================================
-- En 0022_sales.sql hay un trigger que arma 'VTA-' || s.folio. Como ahora
-- folio ya viene con prefijo de sucursal (ej: 'CM-0042'), el folio_text
-- queda 'VTA-CM-0042' lo cual es ruidoso. Reemplazamos por solo s.folio.
-- (Esto requiere recompilar el trigger; el original sigue funcionando pero
-- con concatenación redundante. Lo dejamos para una migración de hardening
-- futura si lo amerita; aquí solo nos aseguramos que no falle.)
