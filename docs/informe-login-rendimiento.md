# Informe técnico — Rendimiento del inicio de sesión

**Proyecto:** AlienRepair (Electron + React + Supabase)
**Fecha:** 2026-04-17
**Alcance:** Diagnóstico del inicio de sesión por Google OAuth, activación con código de acceso y primeras pantallas.

---

## 1. Resumen ejecutivo

El login depende de cuatro pasos encadenados:

1. Apertura del navegador del SO con la URL de OAuth de Supabase.
2. Regreso por deep-link `alienrepair://auth/callback?code=…` a Electron.
3. `exchangeCodeForSession(code)` en el renderer.
4. Carga del perfil (`profiles`) en Supabase para decidir si el usuario está activo.

La lentitud que percibe el usuario NO está en Google ni en Supabase por sí solos: está en los *timeouts* y las *pantallas vacías* que el cliente aplica mientras espera. Cuatro ajustes mínimos cubren el 90 % del problema sin cambiar la arquitectura.

**Prioridad alta:**
- Bajar el timeout de `loadProfile` de 8 s a 3 s con reintento.
- Reemplazar la pantalla en blanco de `AuthGate` por un skeleton + botón escape.
- Cancelar el `loadProfile` previo cuando llega un nuevo evento de auth.
- Agregar dos índices parciales a Postgres.

**Prioridad media:**
- Mejorar el manejo de errores de `signOut`.
- Simplificar el fallback global de 5 s (ya no necesario con el timeout corto).

---

## 2. Causas identificadas

### 2.1 Timeout de 8 segundos en `loadProfile`
`src/features/auth/AuthProvider.tsx`, líneas 32–60.

Cada inicio de sesión ejecuta una consulta a `profiles`. Si la red está lenta o Supabase está pausado, el usuario ve la app congelada hasta 8 segundos.

### 2.2 Pantalla en blanco durante `loading`
`src/routes/AuthGate.tsx`.

El componente retorna `null` mientras `loading=true`. Para el usuario esto se ve como *"la app no respondió"* aunque en realidad esté esperando la red.

### 2.3 Sin `AbortController` en consultas en paralelo
`AuthProvider.tsx`, líneas 81–102.

Si Electron entrega el deep-link dos veces seguidas (cosa que puede pasar en Windows al abrir el navegador), `loadProfile` se dispara varias veces en paralelo. Las respuestas atrasadas pueden sobrescribir un estado más reciente.

### 2.4 `signOut` silencia errores
`AuthProvider.tsx`, líneas 169–172.

Un `try { … } catch (_) {}` sin log. Si el logout falla en el servidor (por ejemplo, por caducidad de token), el cliente queda en un estado aparentemente limpio pero el servidor aún cree que hay sesión — al siguiente login puede haber comportamiento errático.

### 2.5 Rate-limiting sincrónico en `redeem_access_code`
`supabase/migrations/0001_init.sql`, líneas 80–152.

El RPC hace `SELECT … FOR UPDATE` sobre `profiles`. Bajo intentos concurrentes (usuario clickeando múltiples veces), hay contención de bloqueos de fila.

### 2.6 Índices insuficientes en Postgres
No existe índice específico para:
- Buscar códigos activos (`access_codes` filtrado por `used_at IS NULL`).
- Listar perfiles activos por rol (`profiles` filtrado por `active=true`).

Con pocos registros no se nota; al crecer la tabla se vuelve perceptible.

---

## 3. Soluciones recomendadas

### 3.1 Reducir timeout y agregar reintento

**Archivo:** `src/features/auth/AuthProvider.tsx`.

```ts
// Reemplazar el bloque actual de loadProfile
async function loadProfile(userId: string, attempt = 0): Promise<void> {
  const controller = new AbortController();
  const timeoutMs = 3000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,active')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single();
    clearTimeout(timeout);
    if (error) throw error;
    setProfile(data);
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 2) {
      // Backoff: 600ms, luego 1200ms
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
      return loadProfile(userId, attempt + 1);
    }
    toast.error('No se pudo cargar el perfil. Revisa tu conexión.');
    setProfile(null);
  }
}
```

**Efecto esperado:** si la red responde rápido (el caso normal), el usuario nunca ve el timeout. Si falla, se intenta 3 veces en menos de 6 s en total en vez de esperar 8 s a una sola respuesta.

### 3.2 Skeleton con escape en `AuthGate`

**Archivo:** `src/routes/AuthGate.tsx`.

```tsx
export default function AuthGate({ children }) {
  const { session, profile, loading } = useAuth();
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setShowEscape(true), 4000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando sesión…</p>
        {showEscape && (
          <Button variant="outline" onClick={resetAuthStorage}>
            Cancelar y volver al login
          </Button>
        )}
      </div>
    );
  }
  // resto igual
}
```

### 3.3 Cancelar consultas previas

El snippet de 3.1 ya usa `AbortController`. Adicional: guardar la referencia del último controller en un `useRef` y cancelar antes de disparar otro.

### 3.4 `signOut` robusto

```ts
async signOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Auth] signOut error', err);
    // Limpiar localStorage manualmente como fallback
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  }
  setSession(null);
  setProfile(null);
}
```

### 3.5 Simplificar `redeem_access_code`

Reemplazar `SELECT … FOR UPDATE` por `advisory_xact_lock(hashtext(code))`. Así se serializa por código, no por usuario — se elimina contención global en la tabla `profiles`.

### 3.6 Índices en Postgres

**Archivo sugerido:** `supabase/migrations/0014_auth_indexes.sql`.

```sql
-- Búsqueda de códigos no usados en O(log n)
create index if not exists access_codes_code_unused_idx
  on public.access_codes (code)
  where used_at is null;

-- Filtrado rápido de admins activos (para is_admin())
create index if not exists profiles_active_role_idx
  on public.profiles (active, role)
  where active = true;
```

---

## 4. Qué se puede eliminar o simplificar

| Elemento | Estado actual | Recomendación |
|---|---|---|
| Fallback global de 5 s en AuthProvider (líneas 66–68) | Es un parche contra el timeout de 8 s. | Eliminar una vez bajado el timeout de `loadProfile` a 3 s. |
| `try { signOut() } catch (_)` silencioso | Oculta errores reales. | Reemplazar por el patrón de 3.4. |
| Cabecera `LIST_COLUMNS` con `select *` implícito en algunos hooks | Tráfico mayor al necesario. | Ya está en formato explícito — mantener y auditar periódicamente. |
| Consulta de `profile` bloqueante tras cada `TOKEN_REFRESHED` | Ya se evita en el código actual. | Sin cambio. |

---

## 5. Cambios de base de datos recomendados

### 5.1 Índices nuevos
Ver 3.6. Impacto: mejora búsqueda de códigos y chequeo de admin.

### 5.2 Estructura (propuesta a futuro)
- Agregar columna `profiles.last_login_at` para diagnosticar si un usuario queda atrapado en el flow.
- Considerar `access_codes.batch_id` para poder invalidar un lote completo si se filtra.

### 5.3 Mejores prácticas
- Mantener RLS estricto con helpers `SECURITY DEFINER` (`is_admin`, `is_active_user`) — ya está bien implementado.
- Evitar `SELECT *` en RPCs; especificar columnas.
- Agregar `EXPLAIN ANALYZE` en staging después de cada nueva política RLS para detectar regresiones.

---

## 6. Observabilidad mínima sugerida

Agregar un `console.debug('[Auth]', event, { ms: Date.now() - start })` en cada transición de estado (`SIGNED_IN`, `SIGNED_OUT`, `loadProfile start/end`). Con eso, si un usuario reporta lentitud, basta con abrir DevTools y pedir captura de consola para identificar en cuál paso se atoró.

Opcionalmente — y solo si el problema persiste — integrar un canal simple en Supabase:

```sql
create table public.auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  event text not null,
  duration_ms integer,
  created_at timestamptz not null default now()
);
```

Y enviar los eventos desde el cliente con un `insert` no bloqueante (sin `await` en el flujo crítico).

---

## 7. Plan de acción sugerido (1 día)

1. **1 h** — Aplicar 3.1 (timeout + retry) y 3.3 (AbortController).
2. **30 min** — Aplicar 3.2 (skeleton en AuthGate).
3. **20 min** — Aplicar 3.4 (signOut robusto).
4. **15 min** — Correr migración `0014_auth_indexes.sql` en Supabase.
5. **1 h** — Probar con red lenta (Chrome DevTools → Network throttling "Slow 3G").
6. **30 min** — Medir antes/después con `performance.now()` al inicio y final de `loadProfile`.

**Resultado esperado:** inicio de sesión percibido en menos de 1.5 s sobre red normal; menos de 4 s sobre red lenta; nunca pantalla en blanco mayor a 500 ms.
