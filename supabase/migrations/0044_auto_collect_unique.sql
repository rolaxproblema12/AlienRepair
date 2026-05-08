-- =====================================================
-- Migración 0044: Unique partial index para auto-cobro al entregar
--
-- `useUpdateOrderStatus` (src/features/orders/hooks/mutations.ts) crea
-- un order_payment con notes='Cobro automático al entregar' cuando la
-- OS pasa a status='entregado' con saldo > 0. La lógica del cliente
-- chequea idempotencia (existing query antes del INSERT) pero ese check
-- NO es atómico — dos tabs concurrentes pueden ambas pasar el check y
-- crear pagos duplicados, dejando balance negativo.
--
-- Este UNIQUE partial index garantiza atomicidad a nivel DB: la segunda
-- inserción simultánea falla con SQLSTATE 23505 (unique_violation), que
-- el cliente atrapa y trata como "ya cubierto" (skip silencioso).
--
-- Importante: el index es PARCIAL, solo aplica a rows con esa nota
-- exacta. Pagos manuales con otras notes (ej: notes=null o
-- 'Anticipo en efectivo') NO afectan al índice — un cliente puede tener
-- múltiples pagos manuales por OS, lo cual es legítimo.
-- =====================================================

create unique index if not exists order_payments_auto_collect_unique_idx
  on public.order_payments (order_id)
  where notes = 'Cobro automático al entregar';

comment on index public.order_payments_auto_collect_unique_idx is
  'Garantiza un unico pago auto-cobro por OS al pasar a entregado. Race condition entre tabs concurrentes se resuelve a nivel DB (la segunda transaccion falla con 23505 y el cliente la trata como no-op).';
