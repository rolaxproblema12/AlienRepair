-- =====================================================
-- Migración 0029: RLS por sucursal
--
-- Reescribe las policies de TODAS las tablas transaccionales para que
-- usen `is_active_user_in_sucursal(sucursal_id)` en lugar de
-- `is_active_user()` global.
--
-- Patrón:
--   - SELECT/INSERT/UPDATE: is_active_user_in_sucursal(sucursal_id)
--   - DELETE: solo admin (más restrictivo, preserva la lógica original
--     de operaciones destructivas)
--
-- Tablas que NO se tocan en esta migración (siguen igual):
--   - profiles, access_codes, app_settings (compartidas/globales)
--   - sucursales, user_sucursales (su RLS quedó en 0026)
-- =====================================================

-- =====================================================
-- customers
-- =====================================================
drop policy if exists customers_select on public.customers;
drop policy if exists customers_insert on public.customers;
drop policy if exists customers_update on public.customers;
drop policy if exists customers_delete on public.customers;

create policy customers_select on public.customers for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy customers_insert on public.customers for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy customers_update on public.customers for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy customers_delete on public.customers for delete
  using (public.is_admin());

-- =====================================================
-- orders
-- =====================================================
drop policy if exists orders_select on public.orders;
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists orders_delete on public.orders;

create policy orders_select on public.orders for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy orders_insert on public.orders for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy orders_update on public.orders for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy orders_delete on public.orders for delete
  using (public.is_admin());

-- =====================================================
-- order_status_history (escritura solo por triggers)
-- =====================================================
drop policy if exists osh_select on public.order_status_history;

create policy osh_select on public.order_status_history for select
  using (public.is_active_user_in_sucursal(sucursal_id));

-- =====================================================
-- expenses
-- =====================================================
drop policy if exists expenses_select on public.expenses;
drop policy if exists expenses_insert on public.expenses;
drop policy if exists expenses_update on public.expenses;
drop policy if exists expenses_delete on public.expenses;

create policy expenses_select on public.expenses for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy expenses_insert on public.expenses for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy expenses_update on public.expenses for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy expenses_delete on public.expenses for delete
  using (public.is_admin());

-- =====================================================
-- product_categories
-- =====================================================
drop policy if exists product_categories_read on public.product_categories;
drop policy if exists product_categories_admin_write on public.product_categories;

create policy product_categories_select on public.product_categories for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy product_categories_insert on public.product_categories for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy product_categories_update on public.product_categories for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy product_categories_delete on public.product_categories for delete
  using (public.is_admin());

-- =====================================================
-- products
-- =====================================================
drop policy if exists products_read on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

create policy products_select on public.products for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy products_insert on public.products for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy products_update on public.products for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy products_delete on public.products for delete
  using (public.is_admin());

-- =====================================================
-- product_movements
-- =====================================================
drop policy if exists product_movements_read on public.product_movements;
drop policy if exists product_movements_insert on public.product_movements;
drop policy if exists product_movements_admin_delete on public.product_movements;

create policy product_movements_select on public.product_movements for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy product_movements_insert on public.product_movements for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
-- update: histórico inmutable; nadie debería actualizar movimientos
create policy product_movements_delete on public.product_movements for delete
  using (public.is_admin());

-- =====================================================
-- parts
-- =====================================================
drop policy if exists parts_read on public.parts;
drop policy if exists parts_insert on public.parts;
drop policy if exists parts_update on public.parts;
drop policy if exists parts_delete on public.parts;

create policy parts_select on public.parts for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy parts_insert on public.parts for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy parts_update on public.parts for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy parts_delete on public.parts for delete
  using (public.is_admin());

-- =====================================================
-- part_movements
-- =====================================================
drop policy if exists part_movements_read on public.part_movements;
drop policy if exists part_movements_write on public.part_movements;
drop policy if exists part_movements_admin_delete on public.part_movements;

create policy part_movements_select on public.part_movements for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy part_movements_insert on public.part_movements for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy part_movements_delete on public.part_movements for delete
  using (public.is_admin());

-- =====================================================
-- cash_sessions
-- =====================================================
drop policy if exists cash_sessions_read on public.cash_sessions;
drop policy if exists cash_sessions_insert on public.cash_sessions;
drop policy if exists cash_sessions_update on public.cash_sessions;
drop policy if exists cash_sessions_delete on public.cash_sessions;

create policy cash_sessions_select on public.cash_sessions for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy cash_sessions_insert on public.cash_sessions for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy cash_sessions_update on public.cash_sessions for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy cash_sessions_delete on public.cash_sessions for delete
  using (public.is_admin());

-- =====================================================
-- sales
-- =====================================================
drop policy if exists sales_read on public.sales;
drop policy if exists sales_write on public.sales;

create policy sales_select on public.sales for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy sales_insert on public.sales for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy sales_update on public.sales for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy sales_delete on public.sales for delete
  using (public.is_admin());

-- =====================================================
-- sale_items
-- =====================================================
drop policy if exists sale_items_read on public.sale_items;
drop policy if exists sale_items_write on public.sale_items;

create policy sale_items_select on public.sale_items for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy sale_items_insert on public.sale_items for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy sale_items_delete on public.sale_items for delete
  using (public.is_admin());

-- =====================================================
-- order_payments
-- =====================================================
drop policy if exists order_payments_read on public.order_payments;
drop policy if exists order_payments_write on public.order_payments;
drop policy if exists order_payments_update on public.order_payments;
drop policy if exists order_payments_admin_delete on public.order_payments;

create policy order_payments_select on public.order_payments for select
  using (public.is_active_user_in_sucursal(sucursal_id));
create policy order_payments_insert on public.order_payments for insert
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy order_payments_update on public.order_payments for update
  using (public.is_active_user_in_sucursal(sucursal_id))
  with check (public.is_active_user_in_sucursal(sucursal_id));
create policy order_payments_delete on public.order_payments for delete
  using (public.is_admin());

-- =====================================================
-- bot_conversations / bot_messages / bot_notifications_sent / bot_surveys
-- (lectura del bot/automatización; escritura por integración server-side)
-- =====================================================
drop policy if exists bot_conv_select on public.bot_conversations;
create policy bot_conv_select on public.bot_conversations for select
  using (public.is_active_user_in_sucursal(sucursal_id));

drop policy if exists bot_msg_select on public.bot_messages;
create policy bot_msg_select on public.bot_messages for select
  using (public.is_active_user_in_sucursal(sucursal_id));

drop policy if exists bot_notif_select on public.bot_notifications_sent;
create policy bot_notif_select on public.bot_notifications_sent for select
  using (public.is_active_user_in_sucursal(sucursal_id));

drop policy if exists bot_surv_select on public.bot_surveys;
create policy bot_surv_select on public.bot_surveys for select
  using (public.is_active_user_in_sucursal(sucursal_id));
