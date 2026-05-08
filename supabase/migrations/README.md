# Migraciones SQL — AlienRepair

Las migraciones viven aquí, una por archivo `<NNNN>_<nombre>.sql`. El runner es `scripts/migrate.ts`, expuesto vía:

| Comando | Qué hace |
|---|---|
| `npm run db:migrate` | Aplica las migraciones pendientes en orden lexicográfico. Cada archivo va envuelto en una transacción. |
| `npm run db:status` | Lista pendientes vs aplicadas sin ejecutar nada. |
| `npm run db:mark-applied -- <archivo>` | Marca un archivo como aplicado sin ejecutarlo (útil cuando ya corriste el SQL a mano en el dashboard). |

Requiere `SUPABASE_DB_URL` en `.env.local` (connection string Postgres directa — **no** la anon key):

```
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
```

Cada migración aplicada queda registrada en `app._migrations` con `id + hash + applied_at`. Si modificas una migración ya aplicada, el siguiente `db:migrate` aborta con error de hash — esto es intencional (ver "Convenciones" abajo).

## Convenciones

1. **Numeración secuencial**. `0042_diagnosis.sql` viene después de `0041_intake_checklist.sql`. No reutilices números.
2. **Naming descriptivo**. `0041_intake_checklist.sql`, no `0041_changes.sql`.
3. **Transacción implícita**. El runner ya envuelve cada archivo en `BEGIN`/`COMMIT`. **No** incluyas `BEGIN;` o `COMMIT;` explícitos en el cuerpo — duplicarlos rompe el wrapper.
4. **Idempotencia donde sea posible**. Usa `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, y bloques `DO $$ ... IF NOT EXISTS THEN ... END $$` para constraints/políticas. Esto facilita reaplicar migraciones en entornos parcialmente provisionados.
5. **Backward compatible donde sea posible**. Columnas nuevas con `DEFAULT` y `NOT NULL` solo si tienen default; si no, déjalas `NULL` y migra la data en una segunda pasada. La 1.1.1 distribuida sigue funcionando si las columnas nuevas son ignorables.
6. **No edites una migración aplicada**. El hash check del runner está pensado para protegerte. Si necesitas cambiar algo, escribe una nueva migración de compensación (ver abajo).

## Rollback: patrón de migración de compensación

Este runner **no soporta `*.down.sql` automáticos** intencionalmente — un rollback automático sobre datos productivos es un cañón apuntado a tu pie. En su lugar, el patrón es:

> **Para revertir un cambio aplicado, escribe una nueva migración con número siguiente que invierta los efectos.**

### Casos típicos

#### A) Agregaste una columna que necesitas eliminar

```sql
-- 0050_drop_intake_color_column.sql
-- Compensa 0049 que agregó orders.color, decisión revertida.
ALTER TABLE public.orders DROP COLUMN IF EXISTS color;
```

#### B) Creaste una tabla que ya no se usa

```sql
-- 0051_drop_unused_table.sql
-- 0035 creó public.feature_flags pero nunca se consumió.
DROP TABLE IF EXISTS public.feature_flags CASCADE;
```

#### C) Rompiste una constraint que necesitas suavizar

```sql
-- 0052_relax_warranty_void_chk.sql
-- 0041 agregó orders_warranty_void_reason_chk que en producción está
-- bloqueando rows legítimos donde warranty_void=true sin razón
-- explícita (legacy). Removemos la constraint y validamos en app.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_warranty_void_reason_chk;
```

#### D) Trigger / función que está rompiendo

```sql
-- 0053_disable_broken_trigger.sql
-- 0040 introdujo trg_validate_payment que está fallando con sale_payments
-- importadas desde el sistema viejo. La validación ahora vive en hooks.ts.
DROP TRIGGER IF EXISTS trg_validate_payment ON public.order_payments;
DROP FUNCTION IF EXISTS public.validate_payment();
```

### Reglas de las migraciones de compensación

- **Nunca borres ni edites el archivo original**. Tiene que quedar en el historial para que el runner lo verifique contra `app._migrations`.
- **Documenta en el header** qué migración estás compensando y por qué.
- **Idempotente**: usa `IF EXISTS` / `IF NOT EXISTS` para que reaplicarla sea no-op.
- **Cuidado con datos**: si la migración a revertir creó/transformó data, considera si necesitas restaurar antes de invertir el schema. Las migraciones de compensación que tocan DDL son seguras; las que tocan DML pueden destruir.

## Caso especial: migración aplicada con bug, aún no en producción

Si **acabas de ejecutar** una migración con bug y la DB es solo tu desarrollo local:

```sh
# 1. Quita el registro del runner
psql "$SUPABASE_DB_URL" -c "DELETE FROM app._migrations WHERE id = '0050_buggy.sql';"

# 2. Edita el archivo con el fix
# 3. Reaplica
npm run db:migrate
```

**Esto NO es seguro en staging/producción** — usa el patrón de compensación.

## Recuperación ante hash mismatch

Si modificaste una migración ya aplicada (por accidente o por necesidad), el runner aborta:

```
Error: hash mismatch for 0041_intake_checklist.sql
```

Opciones:

- **Mejor**: revierte el archivo a su estado original, deja el bug, y escribe una migración de compensación con el fix real.
- **Solo en dev**: re-marca el hash con `db:mark-applied` después de borrar el registro previo (mismo flujo que arriba).

## Multi-sucursal

Las migraciones 0026-0030 son la base del modelo multi-sucursal y deben aplicarse en orden:

1. `0026_sucursales.sql` — tablas `sucursales` y `user_sucursales`
2. `0027_sucursal_columns.sql` — `sucursal_id` en tablas transaccionales
3. `0028_folio_per_sucursal.sql` — contadores y `next_folio()`
4. `0029_sucursal_rls.sql` — policies con `is_active_user_in_sucursal()`
5. `0030_sucursal_views_triggers.sql` — propagación a tablas hijas

Romper este orden corrompe RLS o deja FKs huérfanas.
