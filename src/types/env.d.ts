/// <reference types="vite/client" />

import type { UpdaterStatus } from '../../shared/updater-types';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface CatalogRefreshResult {
  ok: boolean;
  count: number;
  durationMs: number;
}

interface CatalogRefreshProgress {
  page: number;
  found: number;
}

interface AlienCatalogApi {
  readUserData: () => Promise<unknown[] | null>;
  refresh: () => Promise<CatalogRefreshResult>;
  onRefreshProgress: (cb: (progress: CatalogRefreshProgress) => void) => () => void;
}

interface AlienUpdaterApi {
  onStatus: (cb: (status: UpdaterStatus) => void) => () => void;
  checkNow: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
}

interface AlienApi {
  openExternal: (url: string) => Promise<void>;
  openWhatsApp: (phone: string, message: string) => Promise<void>;
  printDocument: (routePath: string) => Promise<boolean>;
  notifyPrintReady: () => void;
  onAuthDeepLink: (cb: (url: string) => void) => () => void;
  catalog: AlienCatalogApi;
  updater: AlienUpdaterApi;
}

declare global {
  interface Window {
    alien: AlienApi;
  }
}

export {};
