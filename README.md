# AlienRepair

App de escritorio para la gestión integral de reparaciones de dispositivos electrónicos — AlienTechnology.

**Stack**: Electron + Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase

---

## Estado actual

Todas las fases completas:

- **Fase 1** — Bootstrap + Auth (Google OAuth con deep-link + RLS + códigos de acceso).
- **Fase 2** — Clientes + Órdenes de reparación con WhatsApp y seguimiento de estatus.
- **Fase 3** — Encargos, accesorios, agenda, retrasados y sincronización Realtime multi-PC.
- **Fase 4** — Gastos (refacción/general) y contabilidad con KPIs, chart y breakdown por tipo.
- **Fase 5** — Impresión de órdenes de servicio y recibos en carta y térmica 80mm.
- **Fase 6** — Admin (códigos, usuarios, auditoría), Command Palette (Ctrl+K), atajo Ctrl+N, installer NSIS.

---

## Requisitos

- Node.js 20+
- Windows 10/11 (objetivo de build)
- Cuenta Supabase (plan free)
- Cuenta Google Cloud Console (para OAuth)

---

## Setup inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto Supabase

1. Entra a https://app.supabase.com y crea un proyecto nuevo (región más cercana, ej. `East US`).
2. Guarda la contraseña de la base de datos en un lugar seguro.
3. Espera ~2 min a que el proyecto se provisione.
4. En `Settings → API` copia:
   - `Project URL` → a `.env.local` como `VITE_SUPABASE_URL`
   - `anon public key` → a `.env.local` como `VITE_SUPABASE_ANON_KEY`

### 3. Correr las migraciones

En `SQL Editor → New query` ejecuta en orden:

1. `supabase/migrations/0001_init.sql` — profiles, access_codes, RPC, RLS.
2. `supabase/migrations/0002_orders.sql` — customers, orders, historial.
3. `supabase/migrations/0004_expenses.sql` — gastos y vista contable.

Verifica en `Table Editor` que existan las tablas y la vista `v_accounting_daily`.

**Realtime**: en `Database → Replication` habilita la tabla `orders` para que la sincronización multi-PC funcione.

### 4. Configurar Google OAuth

**4.1. En Google Cloud Console** (https://console.cloud.google.com):

1. Crea un proyecto nuevo (o usa uno existente).
2. `APIs & Services → OAuth consent screen`:
   - Tipo: `External`
   - App name: `AlienRepair`
   - Support email: tu correo
   - Scopes: `email`, `profile`, `openid`
   - Test users: agrega tu correo mientras esté en modo testing
3. `Credentials → Create Credentials → OAuth Client ID`:
   - Tipo: `Web application`
   - Name: `AlienRepair Supabase`
   - Authorized redirect URIs: **pega aquí el valor** `https://<tu-proyecto>.supabase.co/auth/v1/callback` (lo ves en Supabase `Authentication → Providers → Google`).
4. Copia `Client ID` y `Client Secret`.

**4.2. En Supabase Authentication**:

1. `Authentication → Providers → Google` → Enable
2. Pega `Client ID` y `Client Secret`
3. Guarda

**4.3. Redirect URL del desktop app**:

En `Authentication → URL Configuration → Redirect URLs`, agrega:

```
alienrepair://auth/callback
```

### 5. Configurar `.env.local`

Copia `.env.example` a `.env.local` y pega las credenciales de Supabase:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 6. Primer arranque

```bash
npm run dev
```

Se abrirá la ventana de AlienRepair con la pantalla de Login. Clic en "Entrar con Google" → autorizas en el navegador → la app te regresa automáticamente (deep-link `alienrepair://`).

### 7. Activar el primer admin

La primera vez tu cuenta queda en estado `active=false` y pedirá un código de acceso. Como aún no hay admin, activa tu cuenta manualmente:

En `Supabase → SQL Editor`:

```sql
update public.profiles
  set role = 'admin', active = true
  where email = 'TU_EMAIL@gmail.com';
```

Recarga la app. Ahora entras al dashboard como admin.

### 8. Crear códigos para otros usuarios

Desde la app: `Admin → Códigos → Generar y copiar` (elige rol y expiración opcional).

Comparte el código al usuario, que al entrar con Google por primera vez lo canjeará en la pantalla "Código de acceso".

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Arranca Electron + Vite con HMR |
| `npm run build` | Compila main, preload y renderer |
| `npm run typecheck` | Verificación TypeScript |
| `npm run dist:win` | Genera instalador `AlienRepair Setup X.Y.Z.exe` en `release/` |

### Generar el instalador para Windows

```bash
npm run dist:win
```

El instalador NSIS queda en `release/AlienRepair Setup 0.1.0.exe`. Permite elegir la carpeta de instalación y registra el protocolo `alienrepair://` para el callback OAuth.

### Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+K` | Abrir Command Palette (búsqueda de folios y clientes) |
| `Ctrl+N` | Nueva reparación |

---

## Estructura

Ver `C:\Users\r\.claude\plans\realiza-desarrollar-una-aplicaci-n-cheerful-ember.md` para el plan completo por fases.

```
electron/       Proceso main, preload, IPC handlers
src/
  features/     Código por dominio (auth, orders, customers, ...)
  components/   UI compartida (shadcn, layout, print templates)
  lib/          supabase, utilidades
  routes/       ProtectedRoute, AdminRoute
  styles/       globals.css, print.css
supabase/
  migrations/   SQL versionado
```

---

## Troubleshooting

- **"Configura VITE_SUPABASE_URL..."** en consola → revisa `.env.local` y reinicia `npm run dev`.
- **OAuth no regresa a la app** → confirma que `alienrepair://auth/callback` está en los Redirect URLs de Supabase.
- **Ventana en blanco** → abre DevTools (ya se abren solas en dev) y revisa la consola.

---

## Licencia

Privado — AlienTechnology.
