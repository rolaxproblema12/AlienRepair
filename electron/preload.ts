import { contextBridge, ipcRenderer } from 'electron';

type UpdaterStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string }
  | { kind: 'not-available' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

const api = {
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  openWhatsApp: (phone: string, message: string) =>
    ipcRenderer.invoke('app:open-whatsapp', phone, message),
  printDocument: (routePath: string) => ipcRenderer.invoke('print:document', routePath),
  notifyPrintReady: () => ipcRenderer.send('print:ready'),
  onAuthDeepLink: (cb: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => cb(url);
    ipcRenderer.on('auth:deep-link', listener);
    return () => ipcRenderer.removeListener('auth:deep-link', listener);
  },
  catalog: {
    readUserData: () => ipcRenderer.invoke('catalog:read-userdata'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
    onRefreshProgress: (
      cb: (progress: { page: number; found: number }) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        progress: { page: number; found: number },
      ) => cb(progress);
      ipcRenderer.on('catalog:refresh-progress', listener);
      return () => ipcRenderer.removeListener('catalog:refresh-progress', listener);
    },
  },
  updater: {
    onStatus: (cb: (status: UpdaterStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: UpdaterStatus) => cb(status);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
    checkNow: () => ipcRenderer.invoke('updater:check'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install'),
  },
};

contextBridge.exposeInMainWorld('alien', api);

export type AlienApi = typeof api;
