-- Tablas y trigger para el bot de atención al cliente (AlienRepair Bot).
-- Mantiene estado de conversaciones, mensajes, idempotencia de notificaciones y encuestas.

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Conversaciones (una fila por cliente-canal)
-- -----------------------------------------------------------------------------
create table if not exists public.bot_conversations (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null check (channel in ('whatsapp','messenger','instagram')),
  channel_user_id   text not null,
  customer_id       uuid references public.customers(id) on delete set null,
  state             text not null default 'IDLE',
  state_data        jsonb not null default '{}'::jsonb,
  needs_attention   boolean not null default false,
  last_message_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (channel, channel_user_id)
);

create index if not exists bot_conversations_customer_idx
  on public.bot_conversations (customer_id);
create index if not exists bot_conversations_attention_idx
  on public.bot_conversations (needs_attention)
  where needs_attention;

-- -----------------------------------------------------------------------------
-- Mensajes (log completo de conversación)
-- -----------------------------------------------------------------------------
create table if not exists public.bot_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.bot_conversations(id) on delete cascade,
  direction         text not null check (direction in ('in','out')),
  text              text not null,
  provider_msg_id   text,
  intent            text,
  created_at        timestamptz not null default now()
);

create index if not exists bot_messages_conv_idx
  on public.bot_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Notificaciones enviadas (idempotencia por orden + estado)
-- -----------------------------------------------------------------------------
create table if not exists public.bot_notifications_sent (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  to_status         order_status not null,
  sent_at           timestamptz not null default now(),
  channel           text not null,
  provider_msg_id   text,
  unique (order_id, to_status)
);

-- -----------------------------------------------------------------------------
-- Encuestas de satisfacción (7 días post-entrega)
-- -----------------------------------------------------------------------------
create table if not exists public.bot_surveys (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  rating          smallint check (rating between 1 and 5),
  comment         text,
  responded_at    timestamptz,
  unique (order_id)
);

create index if not exists bot_surveys_responded_idx
  on public.bot_surveys (responded_at);

-- -----------------------------------------------------------------------------
-- RLS (el service role del bot bypassa; estas políticas son para la app Electron)
-- -----------------------------------------------------------------------------
alter table public.bot_conversations       enable row level security;
alter table public.bot_messages            enable row level security;
alter table public.bot_notifications_sent  enable row level security;
alter table public.bot_surveys             enable row level security;

drop policy if exists bot_conv_select  on public.bot_conversations;
drop policy if exists bot_msg_select   on public.bot_messages;
drop policy if exists bot_notif_select on public.bot_notifications_sent;
drop policy if exists bot_surv_select  on public.bot_surveys;

create policy bot_conv_select  on public.bot_conversations       for select using (public.is_active_user());
create policy bot_msg_select   on public.bot_messages            for select using (public.is_active_user());
create policy bot_notif_select on public.bot_notifications_sent  for select using (public.is_active_user());
create policy bot_surv_select  on public.bot_surveys             for select using (public.is_active_user());

-- -----------------------------------------------------------------------------
-- Trigger: avisar al bot cuando cambia orders.status
--
-- Requiere configurar una sola vez (con credenciales reales):
--   alter database postgres set app.bot_webhook_url    = 'https://<tunnel>/webhook/supabase';
--   alter database postgres set app.bot_webhook_secret = '<SUPABASE_WEBHOOK_SECRET>';
--
-- Si los settings no están, la función no hace nada en vez de romper el UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.notify_bot_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text := current_setting('app.bot_webhook_url', true);
  v_secret text := current_setting('app.bot_webhook_secret', true);
begin
  if new.status is distinct from old.status and v_url is not null and v_url <> '' then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type','application/json','X-Bot-Secret', coalesce(v_secret,'')),
      body    := jsonb_build_object('order_id', new.id, 'to_status', new.status)
    );
  end if;
  return new;
end$$;

drop trigger if exists orders_notify_bot on public.orders;
create trigger orders_notify_bot
  after update of status on public.orders
  for each row
  execute function public.notify_bot_status_change();
