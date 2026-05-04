-- =====================================================
-- Hardening: impedir que un usuario escale sus propios
-- privilegios (role / active) o suplante su identidad
-- (id / email) vía UPDATE directo desde el cliente.
--
-- La policy anterior `profiles_update_own_limited` solo
-- validaba auth.uid() = id, sin restringir columnas,
-- así que cualquiera podía hacerse admin con:
--   update profiles set role='admin' where id=auth.uid()
--
-- Ahora comparamos los valores nuevos contra los previos
-- leídos en la misma fila. Solo `full_name` y `updated_at`
-- son editables por el dueño. Los cambios de role/active
-- solo pasan por:
--   * policy profiles_update_admin (admin directo)
--   * función redeem_access_code (security definer)
-- =====================================================

drop policy if exists profiles_update_own_limited on public.profiles;

create policy profiles_update_own_limited
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and id       = (select p.id       from public.profiles p where p.id = auth.uid())
    and email    is not distinct from (select p.email    from public.profiles p where p.id = auth.uid())
    and role     = (select p.role     from public.profiles p where p.id = auth.uid())
    and active   = (select p.active   from public.profiles p where p.id = auth.uid())
  );
