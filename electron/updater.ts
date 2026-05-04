import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import pkg from 'electron-updater';
import * as Sentry from '@sentry/electron/main';
import type { ReleaseNoteInfo } from 'builder-util-runtime';
import type { UpdaterStatus } from '../shared/updater-types';

const { autoUpdater } = pkg;

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function stringifyNotes(
  n: string | Array<ReleaseNoteInfo> | null | undefined,
): string | undefined {
  if (!n) return undefined;
  if (typeof n === 'string') return n.trim() || undefined;
  return (
    n
      .map((entry) => `${entry.version ? `v${entry.version}\n` : ''}${entry.note ?? ''}`)
      .join('\n\n')
      .trim() || undefined
  );
}

export function setupAutoUpdater(getWindow: () => BrowserWindow | null) {
  // En dev (UPDATE_TEST_DEV=1) electron-updater por defecto se niega a
  // chequear updates "porque la app no está empacada". forceDevUpdateConfig
  // hace que respete dev-app-update.yml igual que en prod.
  if (process.env.UPDATE_TEST_DEV === '1') {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  const send = (status: UpdaterStatus) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('updater:status', status);
  };

  autoUpdater.on('checking-for-update', () => send({ kind: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    send({
      kind: 'available',
      version: info.version,
      releaseNotes: stringifyNotes(info.releaseNotes),
    }),
  );
  autoUpdater.on('update-not-available', () => send({ kind: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    send({ kind: 'downloading', percent: Math.floor(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    send({
      kind: 'downloaded',
      version: info.version,
      releaseNotes: stringifyNotes(info.releaseNotes),
    }),
  );
  autoUpdater.on('error', (err) => {
    Sentry.captureException(err);
    send({ kind: 'error', message: err?.message ?? 'Error de actualización' });
  });

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      Sentry.captureException(err);
      send({ kind: 'error', message: (err as Error).message });
    }
  });

  ipcMain.handle('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall(true, true);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => Sentry.captureException(err));
  }, 5_000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => Sentry.captureException(err));
  }, SIX_HOURS_MS);
}
