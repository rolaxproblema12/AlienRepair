import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;

export type UpdaterStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function setupAutoUpdater(getWindow: () => BrowserWindow | null) {
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
    send({ kind: 'available', version: info.version }),
  );
  autoUpdater.on('update-not-available', () => send({ kind: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    send({ kind: 'downloading', percent: Math.floor(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    send({ kind: 'downloaded', version: info.version }),
  );
  autoUpdater.on('error', (err) =>
    send({ kind: 'error', message: err?.message ?? 'Error de actualización' }),
  );

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      send({ kind: 'error', message: (err as Error).message });
    }
  });

  ipcMain.handle('updater:quit-and-install', () => {
    autoUpdater.quitAndInstall(true, true);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // silenciar fallos de chequeo (sin internet, sin release publicado)
    });
  }, 5_000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, SIX_HOURS_MS);
}
