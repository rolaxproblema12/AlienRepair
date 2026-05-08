# Liberar una nueva versión de AlienRepair

Auto-update está cableado contra **GitHub Releases** del repo
`rolaxproblema12/AlienRepair`. Cuando taggeás una versión nueva,
GitHub Actions construye el `.exe` y publica el Release. La app
instalada en cada PC chequea ese feed cada 6 horas y muestra el
banner "Nueva versión disponible".

---

## Setup inicial (una sola vez)

### 1) Secrets del repo

Ir a `Settings → Secrets and variables → Actions` del repo en GitHub
y crear estos secrets:

| Secret | Para qué | Obligatorio |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | Sí |
| `VITE_SUPABASE_ANON_KEY` | Anon key del proyecto | Sí |
| `VITE_SENTRY_DSN` | DSN de Sentry (renderer) | Opcional |
| `SENTRY_DSN_MAIN` | DSN de Sentry (main process) | Opcional |
| `SENTRY_AUTH_TOKEN` | Token para upload de sourcemaps | Opcional |
| `SENTRY_ORG` | Org de Sentry | Si subís sourcemaps |
| `SENTRY_PROJECT` | Project de Sentry | Si subís sourcemaps |

`GITHUB_TOKEN` lo provee Actions automáticamente — no hay que crearlo.

> **Tip**: usá los mismos valores que tenés en `.env.local`. El cliente
> opera con un solo proyecto Supabase (no separa staging/prod).

### 2) Confirmar que Releases está habilitado

Ir a `Settings → Actions → General → Workflow permissions` y verificar
que `Read and write permissions` esté marcado. Sin esto el workflow
no puede crear el Release.

### 3) Code signing (opcional pero recomendado)

Sin firma de código, Windows muestra "SmartScreen — Windows protegió tu
PC" la primera vez que el cliente abre el `.exe`. La app igual se instala
si hace click en "Más información → Ejecutar de todas formas".

Si querés evitar ese warning, hay que comprar un certificado EV
(~$300 USD/año, Sectigo o DigiCert). Cuando lo tengas:

1. Subí el `.pfx` como secret `WIN_CSC_LINK` (base64) y la password como
   `WIN_CSC_KEY_PASSWORD`.
2. Descomentá las líneas correspondientes en `.github/workflows/release.yml`.

---

## Liberar una versión (flujo normal)

### Pasos

1. **Actualizar `CHANGELOG.md`** con los cambios bajo una nueva entrada
   (ej: `## [1.7.0] — 2026-05-08`).
2. **Commitear el changelog**:
   ```bash
   git add CHANGELOG.md
   git commit -m "docs: changelog v1.7.0"
   ```
3. **Bumpear versión + tag + push**, eligiendo según semver:
   ```bash
   npm run release:patch    # 1.6.3 → 1.6.4 (bugfix)
   npm run release:minor    # 1.6.3 → 1.7.0 (feature)
   npm run release:major    # 1.6.3 → 2.0.0 (breaking)
   ```
   Cada uno corre typecheck + lint + tests primero. Si algo falla,
   se aborta antes de tagear.

### Qué hace `npm run release:*`

```
1. Verifica working tree limpio (sin cambios sin commitear).
2. typecheck + lint + test:run.
3. npm version <patch|minor|major> — bumpea package.json y crea commit + tag.
4. git push origin HEAD --follow-tags — pushea commit y tag.
5. GitHub Actions detecta el tag v*.*.* → arranca release.yml.
6. release.yml construye el .exe en windows-latest y publica el Release.
7. Las apps instaladas chequean el feed en las próximas 6h y muestran banner.
```

El proceso completo (desde push hasta Release publicado) tarda
~6-8 minutos.

### Qué espera el cliente

- Ve un banner ámbar arriba: "Nueva versión X.Y.Z disponible. Descargando…".
- Cuando termina la descarga: "Versión X.Y.Z lista. Reinicia para aplicarla".
- Click "Reiniciar y actualizar" → la app se cierra, instala, vuelve a abrir.

Si el cliente no quiere actualizar ahora, puede ignorar el banner —
la próxima vez que cierre y abra la app, se instala automáticamente
(`autoInstallOnAppQuit: true` en `electron/updater.ts`).

---

## Troubleshooting

### El workflow falló

Mirar la pestaña `Actions` del repo. Causas comunes:

- **Secrets no configurados**: error tipo `Cannot read properties of undefined`
  durante el build. → Volver al paso 1 del setup.
- **Lint o test failing**: arreglar antes de retaguear. Para retaguear la
  misma versión, primero borrar el tag local y remoto:
  ```bash
  git tag -d v1.7.0
  git push origin :refs/tags/v1.7.0
  ```
- **GH_TOKEN sin permisos**: ir a Settings → Actions → General y darle
  write permissions.

### El cliente no ve el banner aunque la versión está en Releases

1. Verificar que el Release esté **publicado** (no draft) en
   `https://github.com/rolaxproblema12/AlienRepair/releases`.
2. Verificar que el `.exe` tenga el nombre `AlienRepair-Setup-X.Y.Z.exe` y
   que esté `latest.yml` adjunto al release. Sin `latest.yml` el updater
   no puede comparar versiones.
3. Hacer click manual en el botón de "Buscar actualizaciones" en el toolbar
   (icono refresh arriba derecha) para forzar el check.
4. Si sigue fallando, mirar los logs de la app instalada:
   `%APPDATA%\AlienRepair\logs\` — ahí electron-updater deja sus errores.

### Hacer rollback de una versión rota

Si publicaste v1.7.0 y rompió todo:

1. **Borrar el Release de GitHub** (Releases → v1.7.0 → Delete) — esto
   evita que más clientes la descarguen.
2. **Publicar v1.7.1 con el fix** (no se puede "downgrade" porque
   `allowDowngrade: false` en updater.ts).
3. Los clientes que ya bajaron v1.7.0 reciben v1.7.1 en el siguiente
   chequeo (~6h o al reabrir la app).

### Probar el updater sin publicar

```bash
$env:UPDATE_TEST_DEV="1"
npm run dev
```

Con esa env var, electron-updater corre en modo dev usando
`dev-app-update.yml`. Podés simular el flujo completo sin generar `.exe`.
La app va a comparar contra el último Release publicado en GitHub.

---

## Versiones especiales

### Hotfix urgente sin pasar por minor

Si v1.7.0 está en producción y necesitás un bugfix YA:
```bash
npm run release:patch    # 1.7.0 → 1.7.1
```

### Pre-release (beta)

```bash
npm version prerelease --preid=beta -m "chore(release): v%s"
git push origin HEAD --follow-tags
```

Genera `v1.7.0-beta.0`. **Importante**: el workflow actual solo dispara
en tags `v*.*.*` (sin sufijo). Para que las betas también disparen, hay
que ajustar el trigger en `.github/workflows/release.yml`.

---

## Archivos relevantes

- `electron/updater.ts` — lógica del auto-updater.
- `electron/main.ts` líneas 112-114 — wiring del updater (solo si packaged).
- `src/components/UpdateBanner.tsx` — banner UI.
- `src/components/UpdateCheckButton.tsx` — botón de check manual.
- `package.json#build.publish` — config del provider GitHub.
- `dev-app-update.yml` — config para testing en dev.
- `.github/workflows/release.yml` — workflow de CI/CD.
