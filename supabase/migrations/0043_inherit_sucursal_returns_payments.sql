-- =====================================================
-- Migración 0043: Triggers de propagación sucursal_id faltantes
--
-- Las migraciones 0035 (sale_returns) y 0039 (sale_payments) agregaron
-- columna sucursal_id pero no agregaron el trigger before-insert que
-- las hereda del padre (sales). Esto deja al cliente como única fuente
-- de verdad para esa columna — riesgo de divergencia si se inserta
-- desde SQL ad-hoc o un script de seed.
--
-- Se sigue el mismo patrón que 0030 (sale_items_inherit_sucursal,
-- order_payments_inherit_sucursal, etc.).
-- =====================================================

-- sale_returns hereda de sales
create or replace function public.sale_returns_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.sale_id is not null then
    select sucursal_id into new.sucursal_id
      from public.sales where id = new.sale_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sale_returns_inherit_sucursal_trg on public.sale_returns;
create trigger sale_returns_inherit_sucursal_trg
  before insert on public.sale_returns
  for each row execute function public.sale_returns_inherit_sucursal();

-- sale_payments hereda de sales
create or replace function public.sale_payments_inherit_sucursal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sucursal_id is null and new.sale_id is not null then
    select sucursal_id into new.sucursal_id
      from public.sales where id = new.sale_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sale_payments_inherit_sucursal_trg on public.sale_payments;
create trigger sale_payments_inherit_sucursal_trg
  before insert on public.sale_payments
  for each row execute function public.sale_payments_inherit_sucursal();
