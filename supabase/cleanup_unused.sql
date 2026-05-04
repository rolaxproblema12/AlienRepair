-- =====================================================================
-- AlienRepair — Limpieza de objetos sin uso
-- =====================================================================
-- Este NO es una migración numerada. Es un script para correr UNA VEZ
-- a mano en el SQL Editor de Supabase. Léelo antes de ejecutar.
--
-- Auditoría confirmada en LOS TRES proyectos que comparten esta DB:
--   1. Electron desktop  (C:/Users/r/Documents/Puntodeventaycontabilidad)
--   2. Web Vercel        (C:/Users/r/Documents/appwebAlienrepair)
--   3. Bot WhatsApp Py   (C:/Users/r/Documents/botwhatssapAlien)
--
-- Solo eliminamos lo que ningún proyecto consume.
-- =====================================================================

-- Vistas obsoletas — ningún proyecto las consulta. La lógica se hace
-- ahora con WHERE directos sobre `orders` o no se usa.
drop view if exists public.v_customer_active_orders;
drop view if exists public.v_overdue_orders;

-- RPC obsoleto — la app de escritorio lo eliminó al simplificar el
-- dashboard. Si nunca aplicaste la migración 0021 que la creaba,
-- este drop es no-op (gracias al `if exists`).
drop function if exists public.get_dashboard_stats();


-- =====================================================================
-- NO eliminar — referencia rápida de qué SÍ se usa
-- =====================================================================
-- Tablas:
--   profiles                  — auth/RLS (electron + web)
--   access_codes              — signup (electron)
--   customers                 — lectura/escritura (los 3 proyectos)
--   orders                    — lectura/escritura + realtime (los 3)
--   order_status_history      — admin audit (electron)
--   expenses                  — contabilidad (electron)
--   bot_conversations         — bot (RW)
--   bot_messages              — bot (W)
--   bot_notifications_sent    — bot idempotencia (RW)
--   bot_surveys               — bot encuestas (RW)
--
-- Vistas:
--   v_accounting_daily        — dashboard chart + /contabilidad (electron)
--
-- Funciones / triggers:
--   redeem_access_code()      — RPC signup (electron)
--   notify_bot_status_change()— trigger en orders → webhook del bot (pg_net)
--   handle_new_user(), set_updated_at(), is_admin(), is_active_user(),
--   orders_sync_delivered(), log_order_status_change()
--                             — internos (RLS / triggers de mantenimiento)
-- =====================================================================
