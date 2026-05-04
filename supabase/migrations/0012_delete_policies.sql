-- =====================================================
-- AlienRepair — Migración 0012
-- Habilitar borrado desde la UI para usuarios creadores
-- de la orden/cliente, conservando el acceso total para
-- administradores.
-- =====================================================

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete
  using (
    public.is_admin()
    or (public.is_active_user() and created_by = auth.uid())
  );

drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete
  using (
    public.is_admin()
    or (public.is_active_user() and created_by = auth.uid())
  );
