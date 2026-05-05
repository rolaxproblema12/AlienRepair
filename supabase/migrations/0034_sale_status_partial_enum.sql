-- =====================================================
-- AlienRepair — Migración 0034
-- Agrega 'parcialmente_devuelta' al enum sale_status.
--
-- Va en archivo separado de 0035 (sale_returns) porque PostgreSQL no
-- permite usar un valor de enum recién agregado dentro de la misma
-- transacción donde se agregó. El migration runner envuelve cada
-- archivo en su propia tx, así que esta tx commitea primero y el
-- trigger de 0035 ya puede referenciar 'parcialmente_devuelta'.
-- =====================================================

alter type sale_status add value if not exists 'parcialmente_devuelta';
