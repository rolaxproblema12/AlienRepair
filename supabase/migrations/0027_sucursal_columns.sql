-- =====================================================
-- Migración 0027: Añadir sucursal_id a tablas transaccionales
--
-- Para cada tabla transaccional:
--   1. Añadir columna sucursal_id uuid references sucursales(id)
--   2. Backfill a 'CM' (Casa Matriz, sembrada en 0026)
--   3. Set NOT NULL
--   4. Crear índice por sucursal_id
--
-- También ajusta constraints únicos que eran globales y ahora deben
-- ser per-sucursal: products.sku, products.barcode, product_categories.name,
-- y el partial unique de cash_sessions(status) where status='open'.
--
-- Nota: NO se actualizan policies RLS aquí (eso lo hace 0029) ni
-- triggers (eso lo hace 0030). Esta migración solo prepara las columnas.
-- =====================================================

-- Helper local: usar el id de Casa Matriz para todos los backfills.
-- Lo capturamos en una sola lectura y reusamos en cada UPDATE.
do $$
declare
  v_default_id uuid;
begin
  select id into v_default_id from public.sucursales where code = 'CM';
  if v_default_id is null then
    raise exception 'Sucursal CM (Casa Matriz) no existe. Aplicar 0026 primero.';
  end if;

  -- ---- customers ----
  alter table public.customers add column sucursal_id uuid references public.sucursales(id);
  update public.customers set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.customers alter column sucursal_id set not null;

  -- ---- orders ----
  alter table public.orders add column sucursal_id uuid references public.sucursales(id);
  update public.orders set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.orders alter column sucursal_id set not null;

  -- ---- order_status_history ----
  alter table public.order_status_history add column sucursal_id uuid references public.sucursales(id);
  update public.order_status_history set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.order_status_history alter column sucursal_id set not null;

  -- ---- expenses ----
  alter table public.expenses add column sucursal_id uuid references public.sucursales(id);
  update public.expenses set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.expenses alter column sucursal_id set not null;

  -- ---- product_categories ----
  alter table public.product_categories add column sucursal_id uuid references public.sucursales(id);
  update public.product_categories set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.product_categories alter column sucursal_id set not null;

  -- ---- products ----
  alter table public.products add column sucursal_id uuid references public.sucursales(id);
  update public.products set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.products alter column sucursal_id set not null;

  -- ---- product_movements ----
  alter table public.product_movements add column sucursal_id uuid references public.sucursales(id);
  update public.product_movements set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.product_movements alter column sucursal_id set not null;

  -- ---- parts ----
  alter table public.parts add column sucursal_id uuid references public.sucursales(id);
  update public.parts set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.parts alter column sucursal_id set not null;

  -- ---- part_movements ----
  alter table public.part_movements add column sucursal_id uuid references public.sucursales(id);
  update public.part_movements set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.part_movements alter column sucursal_id set not null;

  -- ---- cash_sessions ----
  alter table public.cash_sessions add column sucursal_id uuid references public.sucursales(id);
  update public.cash_sessions set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.cash_sessions alter column sucursal_id set not null;

  -- ---- sales ----
  alter table public.sales add column sucursal_id uuid references public.sucursales(id);
  update public.sales set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.sales alter column sucursal_id set not null;

  -- ---- sale_items ----
  alter table public.sale_items add column sucursal_id uuid references public.sucursales(id);
  update public.sale_items set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.sale_items alter column sucursal_id set not null;

  -- ---- order_payments ----
  alter table public.order_payments add column sucursal_id uuid references public.sucursales(id);
  update public.order_payments set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.order_payments alter column sucursal_id set not null;

  -- ---- bot_conversations ----
  alter table public.bot_conversations add column sucursal_id uuid references public.sucursales(id);
  update public.bot_conversations set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.bot_conversations alter column sucursal_id set not null;

  -- ---- bot_messages ----
  alter table public.bot_messages add column sucursal_id uuid references public.sucursales(id);
  update public.bot_messages set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.bot_messages alter column sucursal_id set not null;

  -- ---- bot_notifications_sent ----
  alter table public.bot_notifications_sent add column sucursal_id uuid references public.sucursales(id);
  update public.bot_notifications_sent set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.bot_notifications_sent alter column sucursal_id set not null;

  -- ---- bot_surveys ----
  alter table public.bot_surveys add column sucursal_id uuid references public.sucursales(id);
  update public.bot_surveys set sucursal_id = v_default_id where sucursal_id is null;
  alter table public.bot_surveys alter column sucursal_id set not null;
end $$;

-- =====================================================
-- Índices por sucursal_id (mejora perf de filtrado RLS)
-- =====================================================
create index if not exists customers_sucursal_idx        on public.customers(sucursal_id);
create index if not exists orders_sucursal_idx           on public.orders(sucursal_id);
create index if not exists osh_sucursal_idx              on public.order_status_history(sucursal_id);
create index if not exists expenses_sucursal_idx         on public.expenses(sucursal_id);
create index if not exists product_categories_sucursal_idx on public.product_categories(sucursal_id);
create index if not exists products_sucursal_idx         on public.products(sucursal_id);
create index if not exists product_movements_sucursal_idx on public.product_movements(sucursal_id);
create index if not exists parts_sucursal_idx            on public.parts(sucursal_id);
create index if not exists part_movements_sucursal_idx   on public.part_movements(sucursal_id);
create index if not exists cash_sessions_sucursal_idx    on public.cash_sessions(sucursal_id);
create index if not exists sales_sucursal_idx            on public.sales(sucursal_id);
create index if not exists sale_items_sucursal_idx       on public.sale_items(sucursal_id);
create index if not exists order_payments_sucursal_idx   on public.order_payments(sucursal_id);
create index if not exists bot_conv_sucursal_idx         on public.bot_conversations(sucursal_id);
create index if not exists bot_msg_sucursal_idx          on public.bot_messages(sucursal_id);
create index if not exists bot_notif_sucursal_idx        on public.bot_notifications_sent(sucursal_id);
create index if not exists bot_surveys_sucursal_idx      on public.bot_surveys(sucursal_id);

-- =====================================================
-- Reescribir constraints únicos: globales → por sucursal
-- =====================================================

-- product_categories.name UNIQUE → UNIQUE (sucursal_id, name)
alter table public.product_categories drop constraint if exists product_categories_name_key;
alter table public.product_categories
  add constraint product_categories_sucursal_name_key unique (sucursal_id, name);

-- products.sku UNIQUE → UNIQUE (sucursal_id, sku)
alter table public.products drop constraint if exists products_sku_key;
alter table public.products
  add constraint products_sucursal_sku_key unique (sucursal_id, sku);

-- products.barcode UNIQUE → UNIQUE (sucursal_id, barcode), tolerando NULL
-- (Postgres NULL no colisiona en UNIQUE, así que productos sin barcode siguen funcionando.)
alter table public.products drop constraint if exists products_barcode_key;
alter table public.products
  add constraint products_sucursal_barcode_key unique (sucursal_id, barcode);

-- cash_sessions: una sesión abierta por sucursal (antes era una global).
drop index if exists cash_sessions_one_open_idx;
create unique index cash_sessions_one_open_per_sucursal_idx
  on public.cash_sessions (sucursal_id) where status = 'open';

-- =====================================================
-- Trigger anti-mismatch: child.sucursal_id debe coincidir con parent
-- =====================================================
-- Este es defensa en profundidad. Aunque los hooks del cliente y
-- los triggers de propagación (en 0030) ya setean sucursal_id correctamente,
-- estos checks impiden que un INSERT manual o un bug de RLS introduzca
-- inconsistencias entre child y parent.

create or replace function public.check_sucursal_match()
returns trigger
language plpgsql
as $$
declare
  v_parent_sucursal uuid;
  v_parent_table text := tg_argv[0];
  v_parent_fk_col text := tg_argv[1];
  v_parent_id uuid;
begin
  execute format('select ($1).%I', v_parent_fk_col) using new into v_parent_id;
  if v_parent_id is null then
    return new;
  end if;
  execute format('select sucursal_id from public.%I where id = $1', v_parent_table)
    into v_parent_sucursal using v_parent_id;
  if v_parent_sucursal is not null and new.sucursal_id <> v_parent_sucursal then
    raise exception 'Sucursal mismatch: % en % no coincide con sucursal de %=%',
      new.sucursal_id, tg_table_name, v_parent_fk_col, v_parent_id;
  end if;
  return new;
end;
$$;

-- Tablas hijas validadas (parent_table, parent_fk_col)
create trigger sale_items_check_sucursal
  before insert or update of sucursal_id, sale_id on public.sale_items
  for each row execute function public.check_sucursal_match('sales','sale_id');

create trigger order_payments_check_sucursal
  before insert or update of sucursal_id, order_id on public.order_payments
  for each row execute function public.check_sucursal_match('orders','order_id');

create trigger product_movements_check_sucursal
  before insert or update of sucursal_id, product_id on public.product_movements
  for each row execute function public.check_sucursal_match('products','product_id');

create trigger part_movements_check_sucursal
  before insert or update of sucursal_id, part_id on public.part_movements
  for each row execute function public.check_sucursal_match('parts','part_id');

create trigger order_status_history_check_sucursal
  before insert or update of sucursal_id, order_id on public.order_status_history
  for each row execute function public.check_sucursal_match('orders','order_id');
