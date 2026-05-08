# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AlienRepair** — Electron desktop app for managing electronics repair shops (AlienTechnology).
UI/code is in **Spanish**. Routes:
`/dashboard`, `/caja` (POS + arqueo), `/reparaciones`, `/garantias` (reclamos sobre OS entregadas), `/encargos`, `/accesorios`, `/inventario` (productos del local), `/piezas` (refacciones para reparaciones), `/clientes`, `/agenda`, `/retrasados`, `/gastos`, `/contabilidad`, plus admin sub-routes under `/admin/*` (incluyendo `/admin/sucursales` para gestionar locales). Keep new strings, route names, and DB columns consistent with this Spanish convention.

Stack: Electron 33 + electron-vite + React 18 + TypeScript + Tailwind + shadcn/ui (new-york) + Supabase (auth, Postgres, Realtime).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Boots `electron-vite dev` — main, preload, and Vite renderer with HMR. DevTools open automatically (detached). |
| `npm run build` | Builds all three targets into `dist-electron/main`, `dist-electron/preload`, `dist/`. |
| `npm run typecheck` | `tsc --noEmit` across the project references (`tsconfig.web.json` + `tsconfig.node.json`). |
| `npm run lint` | `eslint .` — config in `eslint.config.js`. CI gates on this. |
| `npm test` / `npm run test:run` | Vitest (`happy-dom` env, setup in `src/test/setup.ts`). Tests live next to the code as `*.{test,spec}.{ts,tsx}`. |
| `npm run test:e2e` | Playwright against the packaged Electron app. Needs `npm run build` first and a staging Supabase project (see `playwright.config.ts`). Specs in `e2e/`. |
| `npm run db:migrate` / `npm run db:status` | Custom runner in `scripts/migrate.ts` — applies SQL files from `supabase/migrations/` against `SUPABASE_DB_URL`, hash-tracked in `app._migrations`. |
| `npm run dist:win` | Builds + runs `electron-builder --win` → NSIS installer in `release/`. Registers `alienrepair://` protocol. Auto-update target: `rolaxproblema12/AlienRepair` (GitHub Releases). |
| `npm run release:patch/minor/major` | Verifica working tree limpio + typecheck + lint + tests, bumpea version, crea commit + tag y pushea con `--follow-tags`. El tag dispara `release.yml` en GitHub Actions que construye y publica el `.exe`. Ver `docs/RELEASING.md` para flujo completo. |

Vitest covers pure logic (lib helpers, schemas, hooks). For UI flows that aren't covered by Playwright, run `npm run dev` and exercise the path manually.

## Three-process layout (electron-vite)

`electron.vite.config.ts` defines three independent builds; do not collapse them:

- **main** (`electron/main.ts` → `dist-electron/main/index.js`, ESM): single `BrowserWindow`, registers `alienrepair://` protocol, owns single-instance lock, forwards OAuth deep-links to the renderer via `auth:deep-link` IPC. `ipcMain.handle` channels: `app:open-external`, `app:open-whatsapp`, `print:document`, `catalog:read-userdata`, `catalog:refresh`, `updater:check`, `updater:quit-and-install`. Sentry is initialized via the side-effect import of `electron/sentry.ts`. Auto-updater (`electron/updater.ts`) is wired only when `app.isPackaged` is true.
- **preload** (`electron/preload.ts` → `dist-electron/preload/index.cjs`, CJS, sandboxed): exposes `window.alien` via `contextBridge`. Type lives in `src/types/env.d.ts` — keep both files in sync when adding IPC.
- **renderer** (`src/`, root is repo root, alias `@` → `src/`): React app, uses `HashRouter` (required because Electron loads via `file://` in production).
- **shared** (`shared/`): types that cross the main/renderer boundary (e.g. `UpdaterStatus`). Imported by both `electron/` and `src/` because both `tsconfig.web.json` and `tsconfig.node.json` include `"shared"`. Don't put runtime code here — only types and pure constants.

When adding IPC: declare the handler in `electron/main.ts`, expose it in `electron/preload.ts`, and extend the `AlienApi` interface in `src/types/env.d.ts`.

## Authentication & access control

The auth flow is non-standard because it spans Electron + browser + Supabase:

1. `signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })` and opens the returned URL in the system browser via `window.alien.openExternal`.
2. Supabase redirects to `alienrepair://auth/callback?code=...`.
3. OS hands the URL to Electron's `open-url` / `second-instance`, which forwards it via IPC to the renderer.
4. `AuthProvider` listens with `window.alien.onAuthDeepLink`, parses the URL, and calls `supabase.auth.exchangeCodeForSession(code)` (PKCE — `flowType: 'pkce'` is set in `src/lib/supabase.ts`, and `detectSessionInUrl: false` because the URL never reaches the renderer naturally).

Access has **two gates** — both must pass:

- `session` (Supabase auth) — handled by `ProtectedRoute`.
- `profile.active` (DB flag in `public.profiles`) — users land on `/signup-code` until they redeem an access code via the `redeem_access_code(text)` RPC (rate-limited: 5 attempts / 10 min, see `supabase/migrations/0001_init.sql`).

Admin-only routes additionally wrap in `AdminRoute` and rely on the `is_admin()` SQL helper for RLS. The first admin must be promoted manually via SQL (`update profiles set role='admin', active=true where email=...`) — the app cannot bootstrap itself.

## Data layer

- **Supabase client**: single instance in `src/lib/supabase.ts`. Uses `localStorage` for session persistence.
- **Server state**: `@tanstack/react-query` (client in `src/lib/queryClient.ts`). All data fetching/mutation lives in `src/features/<domain>/hooks/` (subcarpeta con barrel `index.ts` re-exporta) o `hooks.ts` flat según tamaño del feature.
- **Helpers de invalidación**: `src/lib/queryInvalidation.ts` centraliza las invalidaciones cruzadas. Cada mutation usa `invalidateOrderRelated`, `invalidateSaleRelated`, `invalidateSaleWithStock`, `invalidateProductRelated`, `invalidatePartRelated`, `invalidateCustomerRelated`, `invalidateAccountingRelated`, `invalidateCashSessionRelated` o `removeOrderRelated` en lugar de `qc.invalidateQueries(...)` directo. Si agregás un queryKey nuevo derivado de un dominio, sumalo al helper correspondiente — sino las apps cliente quedan stale en multi-tab.
- **STALE_TIMES** (`src/lib/queryConfig.ts`): tiers `REALTIME` (15s, day-balance) / `FAST` (30s, balance/payments) / `MEDIUM` (60s, detalles) / `SLOW` (5min, catálogos) / `VERY_SLOW` (1h, catálogo externo). NO meter magic numbers en queries — usar siempre el tier correspondiente.
- **Logger** (`src/lib/logger.ts`): `log.error/warn/info/debug` con scope tag (auth/cash/orders/etc). En prod, error y warn rutean a Sentry vía `captureUnlessBenign`; los benignos (PGRST301, JWT expired, Failed to fetch) se filtran. NO usar `console.*` directo en src/ — perdés el routing a Sentry. Excepción: `src/lib/supabase.ts:7` usa `console.warn` por orden de carga (early init pre-Sentry).
- **Realtime sync (multi-PC)**: `src/features/orders/useRealtimeOrders.ts` y `src/features/cash/useRealtimeCash.ts` se suscriben a `postgres_changes` filtrados server-side por `sucursal_id` y disparan los helpers de invalidación. Toasts informativos con dedup por id en eventos relevantes (status update OS, venta nueva). Realtime must be enabled on `public.orders` en Supabase Database → Replication.
- **RLS**: every table is RLS-enabled. Patrón actual:
  - Tablas con sucursal_id usan `is_active_user_in_sucursal(sucursal_id)` (combinación de active + asignación o admin).
  - Tablas globales (profiles, access_codes, app_settings, sucursales, user_sucursales) siguen con sus policies específicas — `is_admin()` para escribir, lectura propia/admin.
  Nuevas tablas/policies van en un archivo numerado bajo `supabase/migrations/`. Migraciones se aplican con `npm run db:migrate` (necesita `SUPABASE_DB_URL` en `.env.local` — connection string Postgres directa, no anon key). El runner (`scripts/migrate.ts`) ejecuta cada archivo dentro de una transacción y registra `id + hash + applied_at` en `app._migrations`; reaplicar un archivo modificado tira con error de hash. `npm run db:status` lista pendientes vs aplicadas. Las cinco migraciones de multi-sucursal son `0026_sucursales.sql`, `0027_sucursal_columns.sql`, `0028_folio_per_sucursal.sql`, `0029_sucursal_rls.sql`, `0030_sucursal_views_triggers.sql` (aplicar en orden).

## Domain structure

```
src/features/<domain>/   # auth, customers, orders, agenda, dashboard,
                         # accounting, admin,
                         # inventory (productos),
                         # parts (refacciones para OS),
                         # cash (POS, ventas, sesiones de caja, abonos a OS),
                         # sucursales, catalog
  hooks.ts               # flat — features chicos
  hooks/                 # carpeta con barrel index.ts para features grandes:
    queries.ts             # cash, inventory, orders splits así
    mutations.ts
    diagnosis.ts (etc)
    index.ts             # re-exporta todo — los consumers siguen importando de '@/features/X/hooks'
  schemas.ts             # zod schemas for forms
  types.ts               # domain TS types
  pages/ or *Page.tsx    # routed pages (registered in src/App.tsx)
src/components/
  ui/                    # shadcn primitives — generated; prefer adding new ones via shadcn CLI
  layout/AppShell.tsx    # sidebar + outlet (sin botón update; ese vive en Configuración)
  layout/CommandPalette.tsx  # Ctrl+K (cmdk)
  print/                 # templates: SaleTicket (térmica fija), ServiceOrderTemplate (carta), ReceiptTemplate (térmica), OrderLabel (80×40mm)
src/routes/              # AuthGate, ProtectedRoute, AdminRoute
src/lib/                 # supabase, queryClient, queryConfig, queryInvalidation, logger, dates, format, printing, whatsapp, utils
```

- `orders` splits its pages into a `pages/` subfolder y comparte una familia `ItemsList`/`ItemOrderForm`/`ItemDetail` entre `encargo` y `accesorio` via prop `kind`. Sus hooks están split en `hooks/{queries,mutations,diagnosis,index}.ts`.
- `cash/hooks/` está dividido en `cashSession.ts`, `sales.ts`, `orderPayments.ts`, `saleReturns.ts` + barrel.
- `inventory/hooks/` en `categories.ts`, `products.ts`, `productMovements.ts`, `productImport.ts`, `inventoryUtility.ts` + barrel.
- `inventory` (productos del local con SKU/barcode/categoría libre) is independent of `parts` (refacciones para reparaciones, con categorías fijas en enum SQL `part_category`).
- `cash` consume tanto `inventory.products` (líneas tipo `producto`) como `orders` via abonos (líneas tipo `abono_orden`).
- `admin/configuracion/` — split en tabs: `ShopDataTab`, `WhatsappTemplatesTab`, `CatalogTab` + helpers `Field`, `TabButton`, `BackupCard`, `UpdateCard`.

## Cross-module data flow (SQL triggers + cliente)

Multiple modules sync via Postgres triggers + lógica del cliente — read carefully before changing any of them:

- **Sale → inventory + payments**: inserting a `sale_items` row with `kind='producto'` fires `sale_item_register_movement` (in `0022_sales.sql`) which inserts a `product_movements` row of `kind='salida'` with snapshot pricing. With `kind='abono_orden'` it inserts an `order_payments` row. The `sync_product_stock` trigger then recomputes `products.stock`.
- **Sale cancellation**: updating `sales.status` to `cancelada` fires `cancel_sale_reverse` which reinserts `product_movements` of `kind='entrada'` and `order_payments` with negative amounts to undo everything atomically.
- **Part used in repair**: inserting `part_movements` with `kind='salida'` and `order_id` set discounts stock via `sync_part_stock`. The view `v_order_balance` then automatically recalculates the order's `total = base_cost + parts_total`, so the saldo del cobro en caja includes the parts without manual edits.
- **Negative-stock guards**: both `prevent_negative_stock` (products) and `prevent_negative_part_stock` (parts) raise an exception on `salida` if it would drive stock below zero. `ajuste` movements bypass this.
- **Cash session uniqueness**: a unique partial index on `cash_sessions (sucursal_id) WHERE status='open'` enforces one open session **per sucursal** (multi-sucursal: cada local maneja su propia caja en paralelo).
- **Auto-cobro al entregar (cliente, no SQL)**: `useUpdateOrderStatus` (mutation en `src/features/orders/hooks/mutations.ts`) lee `v_order_balance` cuando el status pasa a `'entregado'` y, si hay saldo > 0, INSERTa un `order_payments` con method='efectivo' y notes='Cobro automático al entregar'. Idempotente (chequea si ya existe un row con esa nota antes de insertar). NO previene race-condition entre tabs concurrentes — para uso de taller pequeño es aceptable; si en el futuro un cliente reporta balance negativo, mover esta lógica a una RPC SQL con `SELECT ... FOR UPDATE`.

## Garantías

`/garantias` — listado dedicado de OS que son reclamos de garantía. Modelo: NO hay tabla `warranties`; una garantía es una `orders.row` con `warranty_claim_of` (FK a `orders.id`) apuntando a la OS original. Migración `0038_warranty.sql` agregó la columna + index parcial.

- **Hook**: `useWarrantyOrders(filter)` en `orders/hooks/queries.ts` filtra `WHERE warranty_claim_of IS NOT NULL` y joinea `original:orders!warranty_claim_of(id, folio)` para mostrar el folio padre.
- **Wizard "Nueva garantía"**: dialog en `WarrantiesPage` → `CustomerCombobox` → `useCustomerWarrantyOrders(customerId, sucursal.warranty_days)` → click en una OS → navega a `/reparaciones/nueva?cliente=X&warranty=Y&brand=Z&model=W&device=V`.
- **`OrderFormPage`** lee esos query params: `warranty_claim_of` setea ID padre, `cost: 0` por default, brand/model/device pre-llenan, banner amber "🛡️ Garantía de OS #folio" se renderiza arriba.
- **Eligibilidad**: `sucursales.warranty_days` (default 30, configurable en Configuración) determina cuántos días después de `delivered_at` una OS sigue siendo elegible para garantía.

## Multi-sucursal

Cada sucursal (`public.sucursales`, code 2-4 chars + name) tiene sus propias reparaciones, inventario, ventas, gastos, clientes — todo scopeado vía columna `sucursal_id` y RLS. Los catálogos (products, parts, product_categories) son **independientes por sucursal**: el mismo producto en dos locales son dos rows distintos.

- **Asignación**: `public.user_sucursales(user_id, sucursal_id)` es N:N. Admin no necesita aparecer aquí — RLS lo deja pasar siempre vía `is_admin()`. Operadores solo ven datos de las sucursales asignadas.
- **Sucursal activa en el cliente**: `useSucursalStore` (zustand persistido en localStorage `alien:current-sucursal`). Es el único store zustand del proyecto.
- **Hooks scopeados**: cada feature hook llama `useScopedSucursalId()` (tira si no hay) o `useMaybeSucursalId()` (devuelve null), y agrega `sucursal_id` tanto al query key como al filtro de la query y al payload de inserts. AppShell garantiza que ningún componente protegido se monte sin sucursal activa, así que en práctica `useScopedSucursalId` no tira.
- **RLS pattern**: las policies usan `is_active_user_in_sucursal(sucursal_id)` que combina `is_active_user()` con `user_can_access_sucursal()`. Un operador asignado a la sucursal A no puede leer ni escribir datos de la B aunque manipule el cliente.
- **Folios**: `orders.folio` y `sales.folio` son TEXT con formato `<CODE>-<NNNN>` (ej `CM-0042`). Generados por trigger `next_folio(sucursal_id, kind)` que incrementa contador en `public.sucursal_counters`. Folios históricos (pre-migración 0028) quedan como string numérico (`'1'`, `'2'`).
- **Triggers de propagación** (en 0030): tablas hijas (sale_items, order_payments, part_movements, etc.) heredan `sucursal_id` del padre vía trigger `before insert` — el cliente puede omitir el campo y el server lo rellena.
- **Realtime**: `useRealtimeOrders` filtra el subscription server-side con `filter: 'sucursal_id=eq.<id>'`. Cambios en otras sucursales no llegan al cliente.
- **Print templates** reciben sucursal info como prop (`sucursalName`, `sucursalAddress`, `sucursalPhone`) y usan el nombre de la sucursal en lugar del legacy "AlienTechnology".
- **Bootstrap admin de primera sucursal**: si no hay ninguna sucursal en DB, AppShell muestra una pantalla "Sin sucursal asignada" con link a `/admin/sucursales` (rutas admin agnósticas: `/admin/sucursales`, `/admin/users`, `/admin/codes` se renderizan aunque no haya sucursal activa).

## Printing

Printing uses a separate hidden `BrowserWindow`, not `window.print()`:

1. Renderer calls `printDocument(kind, id, size)` from `src/lib/printing.ts`. `PrintKind` is `'order' | 'receipt' | 'sale' | 'report' | 'order-label'`. The route built is `/print/${kind}/${id}?size=carta|termica`.
2. Main spawns a hidden window pointed at that hash route, waits for the print template to call `window.alien.notifyPrintReady()` (the IPC ready handshake — 5s timeout fallback), then triggers `webContents.print({ silent: false, printBackground: true })`.
3. Print routes (`PrintOrderPage`, `PrintReceiptPage`, `PrintSalePage`, `PrintReportPage`, `PrintOrderLabelPage`) live under `ProtectedRoute` but **outside** `AppShell` so the chrome doesn't render.

Three paper sizes:
- **`carta`** — hoja completa US letter (`@page carta { size: letter }`). Usado por order ticket de reparación y reports.
- **`termica`** — 80mm × 297mm (`@page termica`). Usado por sale ticket, receipt de pago de OS.
- **`label`** — 80mm × 40mm (`@page label`) — etiqueta chica del rollo térmico para pegar al equipo recibido. Solo el folio + cliente + brand/modelo. Definido en `src/styles/print.css`.

`PrintOrderMenu` (en `src/components/orders/`) ofrece 3 acciones fijas sin sub-elección: Orden (carta), Recibo (térmica), Etiqueta (térmica 40mm alto). El sale ticket está hardcoded a `termica` porque siempre va al rollo. Templates en `src/components/print/` must call `notifyPrintReady` after data + fonts load, otherwise prints fire blank or fall back to the 5s timeout.

## Auto-update (electron-updater + GitHub Releases)

- Provider: GitHub Releases en `rolaxproblema12/AlienRepair` (público — required para que electron-updater acceda al feed `/releases.atom` sin token; ver `docs/RELEASING.md`).
- **NO** declarar `publisherName` en `package.json#build.win`. Si está, electron-updater valida code-signing en cada update y rechaza binarios sin firma. Como no tenemos cert, debe quedar omitido. Binarios viejos con `publisherName` embebido no pueden auto-actualizar — requieren reinstalación manual UNA vez con un binario nuevo (sin la validación).
- **Workflow**: tag `v*.*.*` dispara `.github/workflows/release.yml` (Node 22 + windows-2022 + secrets `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`). El workflow construye el `.exe` y lo publica en Releases con `latest.yml` adjunto.
- **Verificación de firma deshabilitada**: sin cert EV (~$300/año), Windows muestra SmartScreen warning la primera instalación. "Más información → Ejecutar de todas formas" lo whitelist.
- **UI**: `<UpdateBanner />` global en AppShell (ambient feedback). El botón manual "Buscar actualizaciones" vive en Configuración → Datos del shop → `<UpdateCard />`, no en la barra superior.

## Conventions

- **Path alias**: `@/` → `src/` (configured in `electron.vite.config.ts`, used everywhere in the renderer).
- **shadcn**: `components.json` is set to `style: new-york`, `baseColor: neutral`. Use `npx shadcn@latest add <component>` to extend `src/components/ui/`.
- **Dates**: use `date-fns` + `date-fns-tz`; never `Date.toLocaleString` directly (timezone bugs).
- **Forms**: `react-hook-form` + `zod` via `@hookform/resolvers`. Schemas live next to the feature in `schemas.ts` / `itemSchema.ts`.
- **Toasts**: `sonner` (already mounted in `App.tsx` with dark theme).
- **Keyboard shortcuts**: `Ctrl+K` opens the Command Palette, `Ctrl+N` starts a new repair — both wired in `AppShell` / `CommandPalette`.
- **Env**: `.env.local` must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `src/lib/supabase.ts` warns (does not throw) if missing.

## Gotchas

- The renderer is sandboxed (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`). Anything Node-flavored must go through preload IPC.
- `HashRouter` is required — production loads `file://.../index.html`, where BrowserRouter would break on reload. Print URLs must use `#` (the main process appends it: `${rendererUrl}#${routePath}`).
- `ProtectedRoute` shows a "hard reset" escape hatch after 3s of `loading` to clear corrupted Supabase localStorage state — keep this if you refactor the loading UX.
- `app.requestSingleInstanceLock()` is mandatory; without it, the OAuth deep-link spawns a second Electron instance instead of waking the existing one.
- IPC channel `app:open-external` validates the URL against `^https?://` / `mailto:`. Do not weaken this check.
- **`vitest` fijado a `^3.2.4`** — vitest 4 requiere vite 6+ (peer dep), que electron-vite 2.x todavía no soporta. NPM 11 toleraba el conflict, npm 10 (CI con Node viejo) lo detectaba como `Missing esbuild@0.28`. Si bumpeás vite a 6+, podés volver a vitest 4.
- **CI fijado a `windows-2022` y Node 22** — `windows-latest` se está moviendo a `windows-2025-vs2026` (mayo 2026) y rompió el toolchain de electron-builder; Node 20 con npm 10 antiguo daba falsos "Missing X from lock file" sobre locks escritos por npm 11+.
- **Tests con dummies de Supabase** — el step "Tests" del CI inyecta `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` placeholder porque `src/lib/supabase.ts` invoca `createClient(url, anon, ...)` al import (top-level) y aborta sin valores válidos. Los tests no hacen requests reales (mockean per-archivo) pero la inicialización corre antes que los mocks intercepten.
- **Optimistic updates** (`useSaveRepairOrder`, `useSaveItemOrder`, `useUpdateOrderStatus`): si el `setQueryData` no incluye TODOS los campos del payload, el rollback en `onError` deja state mezclado. Mantener el optimistic en sync con el `mutationFn` — si agregás campo nuevo al payload, agregalo también al optimistic.
- **Cambio de sucursal mid-trabajo**: `NewSalePage` y `OrderFormPage` watchean `sucursalId` con `useRef` y al detectar cambio cancelan el carrito/form y redirigen con un toast warning. La sesión de caja es per-sucursal — cobrar contra la sesión equivocada sería un error contable.
