# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AlienRepair** — Electron desktop app for managing electronics repair shops (AlienTechnology).
UI/code is in **Spanish**. Routes:
`/dashboard`, `/caja` (POS + arqueo), `/reparaciones`, `/encargos`, `/accesorios`, `/inventario` (productos del local), `/piezas` (refacciones para reparaciones), `/clientes`, `/agenda`, `/retrasados`, `/gastos`, `/contabilidad`, plus admin sub-routes under `/admin/*` (incluyendo `/admin/sucursales` para gestionar locales). Keep new strings, route names, and DB columns consistent with this Spanish convention.

Stack: Electron 33 + electron-vite + React 18 + TypeScript + Tailwind + shadcn/ui (new-york) + Supabase (auth, Postgres, Realtime).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Boots `electron-vite dev` — main, preload, and Vite renderer with HMR. DevTools open automatically (detached). |
| `npm run build` | Builds all three targets into `dist-electron/main`, `dist-electron/preload`, `dist/`. |
| `npm run typecheck` | `tsc --noEmit` — there is no test runner and no linter configured; this is the only static check. |
| `npm run dist:win` | Builds + runs `electron-builder --win` → NSIS installer in `release/`. Registers `alienrepair://` protocol. |

There are no unit/integration tests. Verify changes by running `npm run dev` and exercising the affected flow.

## Three-process layout (electron-vite)

`electron.vite.config.ts` defines three independent builds; do not collapse them:

- **main** (`electron/main.ts` → `dist-electron/main/index.js`, ESM): single `BrowserWindow`, registers `alienrepair://` protocol, owns single-instance lock, forwards OAuth deep-links to the renderer via `auth:deep-link` IPC, and exposes three `ipcMain.handle` channels: `app:open-external`, `app:open-whatsapp`, `print:document`.
- **preload** (`electron/preload.ts` → `dist-electron/preload/index.cjs`, CJS, sandboxed): exposes `window.alien` via `contextBridge`. Type lives in `src/types/env.d.ts` — keep both files in sync when adding IPC.
- **renderer** (`src/`, root is repo root, alias `@` → `src/`): React app, uses `HashRouter` (required because Electron loads via `file://` in production).

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
- **Server state**: `@tanstack/react-query` (client in `src/lib/queryClient.ts`). All data fetching/mutation lives in `src/features/<domain>/hooks.ts`.
- **Realtime sync (multi-PC)**: `src/features/orders/useRealtimeOrders.ts` subscribes to `postgres_changes` on `public.orders` and invalidates the relevant React Query keys, **discriminated by event type and payload diff** (only invalidates `orders-overdue*` if the row actually transitioned in/out of overdue, only invalidates `customer-orders` / `customer-active-orders` for the affected `customer_id`). Keys touched: `orders`, `orders-agenda`, `orders-overdue`, `orders-overdue-count`, `customer-orders`, `customer-active-orders`, `order/:id`. When you add a new query key derived from `orders`, add it to that invalidation list. Realtime must be enabled on `public.orders` in Supabase Database → Replication.
- **RLS**: every table is RLS-enabled. Patrón actual:
  - Tablas con sucursal_id usan `is_active_user_in_sucursal(sucursal_id)` (combinación de active + asignación o admin).
  - Tablas globales (profiles, access_codes, app_settings, sucursales, user_sucursales) siguen con sus policies específicas — `is_admin()` para escribir, lectura propia/admin.
  Nuevas tablas/policies van en un archivo numerado bajo `supabase/migrations/`. Migraciones se aplican **manualmente** vía Supabase SQL editor — no hay migration runner. Latest migrations to apply on a fresh DB: `0021_inventory.sql`, `0022_sales.sql`, `0023_parts.sql`, **`0026_sucursales.sql`, `0027_sucursal_columns.sql`, `0028_folio_per_sucursal.sql`, `0029_sucursal_rls.sql`, `0030_sucursal_views_triggers.sql`** (las cinco de multi-sucursal aplicar en orden).

## Domain structure

```
src/features/<domain>/   # auth, customers, orders, agenda, dashboard,
                         # accounting, admin,
                         # inventory (productos),
                         # parts (refacciones para OS),
                         # cash (POS, ventas, sesiones de caja, abonos a OS)
  hooks.ts               # React Query hooks (queries + mutations)
  schemas.ts             # zod schemas for forms
  types.ts               # domain TS types
  pages/ or *Page.tsx    # routed pages (registered in src/App.tsx)
src/components/
  ui/                    # shadcn primitives — generated; prefer adding new ones via shadcn CLI
  layout/AppShell.tsx    # sidebar + outlet
  layout/CommandPalette.tsx  # Ctrl+K (cmdk)
  print/                 # carta + 80mm thermal print templates (incluye SaleTicket.tsx)
src/routes/              # AuthGate, ProtectedRoute, AdminRoute
src/lib/                 # supabase, queryClient, dates, format, printing, whatsapp, utils
```

- `orders` splits its pages into a `pages/` subfolder and shares one `ItemsList`/`ItemOrderForm`/`ItemDetail` component family between `encargo` and `accesorio` via a `kind` prop. Other features keep their pages flat at the root of the feature folder.
- `inventory` (productos del local con SKU/barcode/categoría libre) is independent of `parts` (refacciones para reparaciones, con categorías fijas en enum SQL `part_category`).
- `cash` consume tanto `inventory.products` (líneas tipo `producto`) como `orders` via abonos (líneas tipo `abono_orden`).

## Cross-module data flow (SQL triggers)

Multiple modules sync via Postgres triggers — read carefully before changing any of them:

- **Sale → inventory + payments**: inserting a `sale_items` row with `kind='producto'` fires `sale_item_register_movement` (in `0022_sales.sql`) which inserts a `product_movements` row of `kind='salida'` with snapshot pricing. With `kind='abono_orden'` it inserts an `order_payments` row. The `sync_product_stock` trigger then recomputes `products.stock`.
- **Sale cancellation**: updating `sales.status` to `cancelada` fires `cancel_sale_reverse` which reinserts `product_movements` of `kind='entrada'` and `order_payments` with negative amounts to undo everything atomically.
- **Part used in repair**: inserting `part_movements` with `kind='salida'` and `order_id` set discounts stock via `sync_part_stock`. The view `v_order_balance` then automatically recalculates the order's `total = base_cost + parts_total`, so the saldo del cobro en caja includes the parts without manual edits.
- **Negative-stock guards**: both `prevent_negative_stock` (products) and `prevent_negative_part_stock` (parts) raise an exception on `salida` if it would drive stock below zero. `ajuste` movements bypass this.
- **Cash session uniqueness**: a unique partial index on `cash_sessions (sucursal_id) WHERE status='open'` enforces one open session **per sucursal** (multi-sucursal: cada local maneja su propia caja en paralelo).

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

1. Renderer calls `printDocument(kind, id, size)` from `src/lib/printing.ts`. `PrintKind` is `'order' | 'receipt' | 'sale'`. The route built is `/print/${kind}/${id}?size=carta|termica`.
2. Main spawns a hidden window pointed at that hash route, waits for the print template to call `window.alien.notifyPrintReady()` (the IPC ready handshake — 5s timeout fallback), then triggers `webContents.print({ silent: false, printBackground: true })`.
3. Print routes (`PrintOrderPage`, `PrintReceiptPage`, `PrintSalePage`) live under `ProtectedRoute` but **outside** `AppShell` so the chrome doesn't render.

Two paper sizes — `carta` and `termica` (80mm) — switched via the `size` query param. The sale ticket (`SaleTicket.tsx`) is hardcoded to `termica` since it's a POS receipt. Templates in `src/components/print/` must call `notifyPrintReady` after data + fonts load, otherwise prints fire blank or fall back to the 5s timeout.

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
