# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [1.6.4] — 2026-05-08

### Added
- **Helpers de invalidación centralizados** (`src/lib/queryInvalidation.ts`): 8 helpers (`invalidateOrderRelated`, `invalidateSaleRelated`, `invalidateSaleWithStock`, `invalidateProductRelated`, `invalidatePartRelated`, `invalidateCustomerRelated`, `invalidateAccountingRelated`, `invalidateCashSessionRelated`). Reemplazan ~150 llamadas dispersas de `qc.invalidateQueries({...})` con riesgo de olvidar keys.
- **Logger centralizado** (`src/lib/logger.ts`): wrapper Sentry con scope tag, reemplaza ~13 `console.*` directos.
- **STALE_TIMES constants** (`src/lib/queryConfig.ts`): tiers REALTIME/FAST/MEDIUM/SLOW/VERY_SLOW para reemplazar magic numbers.
- **Etiqueta de OS** (nuevo PrintKind `'order-label'`): impresión 80mm × 40mm en rollo térmico con folio + cliente + marca/modelo, para pegar al equipo recibido.
- **Migración 0043**: triggers `sale_returns_inherit_sucursal` y `sale_payments_inherit_sucursal` que faltaban (las tablas tenían `sucursal_id` pero no heredaban del padre como las otras hijas).
- **Auto-update setup**: scripts `npm run release:patch/minor/major` (verifica + bumpea + tag + push), `docs/RELEASING.md` con flujo completo, troubleshooting y rollback.
- **Tests**: `itemSchema.test`, `OrdersListPage.test`, `schemas.test`, `parts/schemas.test`, `whatsapp.test`, `e2e/orders/diagnosis.spec`. Total: 147 pasando.
- **Versión visible** en footer del sidebar (`v1.6.4` leída de `package.json`).

### Changed
- **Split de archivos hooks grandes** con barrel re-export (sin romper imports existentes):
  - `cash/hooks.ts` (759L) → `cash/hooks/{cashSession,sales,orderPayments,saleReturns,index}.ts`
  - `inventory/hooks.ts` (547L) → `inventory/hooks/{categories,products,productMovements,productImport,inventoryUtility,index}.ts`
  - `orders/hooks.ts` (482L) → `orders/hooks/{queries,mutations,diagnosis,index}.ts`
- **ConfiguracionPage** (548L) → page minimalista + componentes hijos en `admin/configuracion/`.
- **PrintOrderMenu** simplificado: 3 acciones fijas (orden carta, recibo térmica, etiqueta) en lugar de 4 sub-opciones de tamaño.
- **Realtime feedback**: `useRealtimeOrders` y `useRealtimeCash` ahora muestran toast informativo al detectar cambios de otras sesiones (status update OS, venta nueva).
- **`normalizePhone`** respeta el `+` explícito del usuario en lugar de forzar `52` (México) — compat internacional.

### Fixed
- **Logger**: `log.warn` ya llega a Sentry (antes quedaba silenciado); `captureUnlessBenign` ya no duplica extras ni pierde el `setLevel`.
- **`useUpdateOrderStatus`** invalida accounting siempre que cambia status (antes no detectaba transición DESDE 'entregado' al reabrir una OS).
- **Optimistic updates** en `useSaveRepairOrder` / `useSaveItemOrder` ahora cubren todos los campos del payload (antes el rollback dejaba estado mezclado al fallar).
- **Cleanup de carrito** en `NewSalePage` y form en `OrderFormPage` al cambiar de sucursal mid-trabajo (antes los datos persistían y podías cobrar contra la sesión equivocada).
- **Pantalla en blanco** al cerrarse caja desde otra PC reemplazada por loader + mensaje claro.
- **Validación teléfono** mensaje de error con ejemplo internacional.
- **`window.confirm()`** nativos en `UsersPage` reemplazados por Dialog shadcn (2 lugares).
- **OrderFormPage**: feedback inline cuando anticipo > costo + label "calculado automáticamente" en Saldo readonly.
- **Botón Cobrar** deshabilitado si total ≤ 0 (antes solo chequeaba carrito vacío).
- **ProductPicker**: badge rojo "Sin stock" visible para productos con stock 0 (antes solo opacity 60% confuso).
- **print.css 80mm**: `word-break: break-word` para descripciones largas que rompían el ancho.
- **Migración 0043**: dos triggers de propagación de `sucursal_id` que faltaban.
- **CI**: Node 20 → 22 LTS, `windows-latest` → `windows-2022`, vitest 4 → 3.2.4 para compat con vite 5, dummies de Supabase en step de tests.

## [Skipped]

### Added
- **Realtime para caja**: hook `useRealtimeCash` que sincroniza ventas, abonos, movimientos de productos y piezas, y devoluciones entre PCs de la misma sucursal (replica el patrón de `useRealtimeOrders`).
- **Lectura defensiva del checklist de ingreso**: helper `sanitizeIntakeChecklist` aplica zod safeParse al JSON `orders.intake_checklist` al leer; si llega corrupto desde DB se degrada a `null` en lugar de propagar al UI.
- **UsersPage**: badge con conteo de sucursales asignadas por usuario y advertencia roja "Sin acceso" para operadores activos sin asignación. Confirmación antes de activar/quitar admin si dejaría al usuario sin acceso.
- **Pantalla "Sin sucursal asignada"**: mensaje diferenciado según rol; operadores ven botón de cerrar sesión, admins ven shortcuts a sucursales y usuarios.
- **Tests responsivos del kanban**: regresión visual sobre `KANBAN_GRID_CLASSES` (4 breakpoints, 6 columnas igual a `ORDER_STATUSES.length`).

### Changed
- **DiagnosisDialog unificado**: fusiona `DiagnosisDialog` y `NewDiagnosisDialog` en un solo componente con prop `order` opcional. Si se pasa, va directo al form; si no, muestra picker de OS abiertas.
- **PrintOrderPage / PrintReceiptPage / PrintSalePage**: notifican `print-ready` también en error/no-encontrado para que el print imprima la pantalla de error en lugar de esperar el timeout de 5s y soltar papel en blanco. Se agregó estado de error visible.
- **CommandPalette / AddPartToOrderDialog / ReturnItemDialog / ConfiguracionPage**: refactor para eliminar 4 ocurrencias de `eslint-disable react-hooks/set-state-in-effect` (los 2 restantes en `OrderKanbanCard/Column` son inevitables por dnd-kit).

### Documentation
- Nuevo `CHANGELOG.md`.
- Nuevo `supabase/migrations/README.md` con patrón de rollback (migración de compensación).

## [1.6.3] — 2026-05-05

### Added
- **Checklist de ingreso de equipos** (`orders.intake_checklist`, migración 0041): formulario con grupos visuales, batería %, OK/Falla/N/C por item; warranty void automático cuando aplica reason mojado/sin_codigo.
- **Cierre de diagnóstico** con plantilla WhatsApp + transición automática `pendiente → diagnostico`.
- **Kanban responsivo**: layout 1 col móvil → 6 col desktop.

### Fixed
- Timezone shift en strings DATE-only (estimated_delivery, fechas de caja) causaba off-by-one en husos negativos (`dfef679`).

## [1.2.0] — 2026-05-05

### Added
- **Multi-sucursal completo**: tablas `sucursales`, `user_sucursales`, columna `sucursal_id` en todas las tablas transaccionales, RLS scopeada con `is_active_user_in_sucursal()`, contadores de folio per-sucursal (`next_folio`), triggers de propagación a tablas hijas. Migraciones 0026-0030.
- **Caja (POS)**: sesiones de caja per-sucursal con apertura/cierre + arqueo, ventas con line items (`producto`, `accesorio`, `abono_orden`), split tender (varios métodos por venta), devoluciones parciales, ticket térmico de 80mm.
- **Inventario / Piezas**: dos catálogos independientes (productos del local con SKU/barcode/categoría libre; piezas para reparaciones con enum SQL `part_category`). Triggers `prevent_negative_stock` y `prevent_negative_part_stock`.
- **Reportes** (`/reportes`): 4 reportes con filtros y exports CSV/PDF; reporte de empleados con comisiones por venta.
- **Garantías**: campo `warranty_claim_of` en orders, vista `v_warranty_claims` para seguimiento de reclamos.
- **WhatsApp automático** en cambios de status con plantillas configurables per-sucursal.
- **Búsqueda global** Ctrl+K (CommandPalette): clientes, OS, productos, piezas, ventas.
- **Tema dark/light** persistido en localStorage.
- **Auto-updater** Electron contra GitHub Releases (`rolaxproblema12/AlienRepair`).
- **Backup/export** de datos de la sucursal (admin).
- **Pagination** en `/caja/historial` y `/gastos`.
- **Tests E2E Playwright** (5 specs): RLS isolation, orders lifecycle, parts → balance trigger, auth/redeem, printing handshake.

### Performance
- Índices SQL faltantes en filtros frecuentes (`2174eca`).
- Reducción de consultas innecesarias contra el free tier (`01125c6`).

### Fixed
- Hook faltante `useCustomerWarrantyOrders`.
- `useMemo` movido arriba de `return` condicional en `NewSalePage`.
- Auto-update publish target apuntando al repo correcto.
- Silenciados 37 warnings de ESLint y 2 errores de consola (DataCloneError, a11y).

## [1.1.1] — 2026-05-04

### Added
- Versión inicial publicada de AlienRepair.
- Stack base: Electron 33 + electron-vite + React 18 + TypeScript + Tailwind + shadcn/ui + Supabase.
- Auth OAuth Google con deep-link `alienrepair://`.
- CRUD de clientes, OS de reparación, encargos, accesorios.
- Agenda de entregas + dashboard.
- Print de orden de servicio y recibo en carta y térmica.

[Unreleased]: https://github.com/rolaxproblema12/AlienRepair/compare/v1.6.3...HEAD
[1.6.3]: https://github.com/rolaxproblema12/AlienRepair/compare/v1.2.0...v1.6.3
[1.2.0]: https://github.com/rolaxproblema12/AlienRepair/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/rolaxproblema12/AlienRepair/releases/tag/v1.1.1
