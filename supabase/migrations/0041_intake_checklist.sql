-- =====================================================
-- AlienRepair — Migración 0041
-- Checklist de ingreso del equipo (opcional) + warranty void.
--
-- Patrón: todos los campos nullable / con default. Las OS existentes
-- quedan con applies=NULL (no registrado) y warranty_void=false.
-- 100% backward compatible — la app 1.1.1 ya distribuida sigue
-- funcionando porque ignora columnas nuevas.
-- =====================================================

-- 1) Columnas en orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS intake_checklist_applies      boolean,
  ADD COLUMN IF NOT EXISTS intake_checklist_reason       text,
  ADD COLUMN IF NOT EXISTS intake_checklist_reason_other text,
  ADD COLUMN IF NOT EXISTS intake_checklist              jsonb,
  ADD COLUMN IF NOT EXISTS warranty_void                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_void_reason          text;

-- 2) Constraint enum-like sobre la razón
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_intake_checklist_reason_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_intake_checklist_reason_chk
      CHECK (
        intake_checklist_reason IS NULL
        OR intake_checklist_reason IN ('apagado', 'mojado', 'sin_codigo', 'otro')
      );
  END IF;
END $$;

-- 3) Constraint de coherencia entre applies / reason / data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_intake_checklist_consistency_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_intake_checklist_consistency_chk
      CHECK (
        -- Sin elegir: todo nulo.
        (intake_checklist_applies IS NULL
          AND intake_checklist_reason IS NULL
          AND intake_checklist_reason_other IS NULL
          AND intake_checklist IS NULL)
        OR
        -- Aplica: data presente, sin razón.
        (intake_checklist_applies = true
          AND intake_checklist IS NOT NULL
          AND intake_checklist_reason IS NULL
          AND intake_checklist_reason_other IS NULL)
        OR
        -- No aplica: razón presente, sin data. reason_other solo si reason='otro'.
        (intake_checklist_applies = false
          AND intake_checklist_reason IS NOT NULL
          AND intake_checklist IS NULL
          AND (
            (intake_checklist_reason = 'otro' AND intake_checklist_reason_other IS NOT NULL)
            OR (intake_checklist_reason <> 'otro' AND intake_checklist_reason_other IS NULL)
          ))
      );
  END IF;
END $$;

-- 4) Constraint para warranty_void_reason cuando warranty_void=true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_warranty_void_reason_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_warranty_void_reason_chk
      CHECK (
        (warranty_void = false AND warranty_void_reason IS NULL)
        OR
        (warranty_void = true AND warranty_void_reason IS NOT NULL)
      );
  END IF;
END $$;

-- 5) Comentarios
COMMENT ON COLUMN public.orders.intake_checklist_applies IS
  'NULL = sin registrar, true = se hizo checklist, false = no aplica (equipo apagado/mojado/sin código).';
COMMENT ON COLUMN public.orders.intake_checklist_reason IS
  'Razón cuando applies=false: apagado | mojado | sin_codigo | otro.';
COMMENT ON COLUMN public.orders.intake_checklist IS
  'JSON con estado de items (pantalla, touch, cámaras, batería %, etc.) cuando applies=true.';
COMMENT ON COLUMN public.orders.warranty_void IS
  'Si true, este equipo no recibe garantía. Se auto-marca cuando intake_checklist_reason ∈ (mojado, sin_codigo).';
COMMENT ON COLUMN public.orders.warranty_void_reason IS
  'Razón por la que no aplica garantía (mojado | sin_codigo | manual).';
