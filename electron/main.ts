import './sentry';
import { app, BrowserWindow, ipcMain, net, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setupAutoUpdater } from './updater';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL = 'alienrepair';

let mainWindow: BrowserWindow | null = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const raw = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (raw) forwardDeepLink(raw);
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  forwardDeepLink(url);
});

function forwardDeepLink(raw: string) {
  if (!mainWindow) return;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return;
  }
  if (parsed.protocol !== `${PROTOCOL}:`) return;
  if (parsed.hostname !== 'auth' || parsed.pathname !== '/callback') return;
  mainWindow.webContents.send('auth:deep-link', parsed.toString());
}

function isAllowedRendererUrl(target: string) {
  if (process.env.ELECTRON_RENDERER_URL && target.startsWith(process.env.ELECTRON_RENDERER_URL)) {
    return true;
  }
  const prodBase = `file://${path.join(__dirname, '../../dist/index.html').replace(/\\/g, '/')}`;
  return target.startsWith(prodBase) || target.startsWith('file://') && target.includes('/dist/index.html');
}

function hardenWebContents(wc: Electron.WebContents) {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) || url.startsWith('mailto:')) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!isAllowedRendererUrl(url)) {
      event.preventDefault();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  hardenWebContents(mainWindow.webContents);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    // En dev siempre abrimos DevTools para diagnosticar errores rápido.
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Auto-update solo en producción empacada (no en dev).
  if (app.isPackaged) {
    setupAutoUpdater(() => mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:open-external', async (_event, url: string) => {
  if (!/^https?:\/\//.test(url) && !url.startsWith('mailto:')) {
    throw new Error('URL no permitida');
  }
  await shell.openExternal(url);
});

ipcMain.handle('app:open-whatsapp', async (_event, phone: string, message: string) => {
  const clean = phone.replace(/[^\d]/g, '');
  const text = encodeURIComponent(message ?? '');
  await shell.openExternal(`https://wa.me/${clean}?text=${text}`);
});

// =====================================================
// Catálogo de proveedor (FixOEM) — userData + refresh
// =====================================================
function userDataCatalogPath() {
  return path.join(app.getPath('userData'), 'catalog.json');
}

ipcMain.handle('catalog:read-userdata', async () => {
  try {
    const raw = await readFile(userDataCatalogPath(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

interface ShopifyProduct {
  id: number;
  title?: string;
  vendor?: string;
  body_html?: string;
  variants?: Array<{ sku?: string; price?: string }>;
}

interface NormalizedProduct {
  id: number;
  vendor: string;
  title: string;
  category: string;
  models: string[];
  sku: string;
  price: number | null;
}

function normalize(p: ShopifyProduct): NormalizedProduct {
  const body = (p.body_html || '').replace(/<[^>]+>/g, '').replace(/\r/g, '');
  const catMatch = body.match(/Categor[íi]a\s*:\s*([^\n]+)/i);
  const category = catMatch ? catMatch[1].trim() : '';
  let models: string[] = [];
  const modSection = body.match(
    /Modelos\s+Compatibles\s*:\s*([\s\S]*?)(?:\n\s*\n|Detalles:|$)/i,
  );
  if (modSection) {
    models = modSection[1]
      .split('\n')
      .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean);
  }
  const v = p.variants?.[0];
  return {
    id: p.id,
    vendor: p.vendor || '',
    title: p.title || '',
    category,
    models,
    sku: v?.sku || '',
    price: v?.price ? Number(v.price) : null,
  };
}

ipcMain.handle('catalog:refresh', async (event) => {
  const start = Date.now();
  const seen = new Set<number>();
  const products: NormalizedProduct[] = [];
  const MAX_PAGES = 50;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let data: { products?: ShopifyProduct[] };
    try {
      const res = await net.fetch(
        `https://fixoem.com/products.json?limit=250&page=${page}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status} en página ${page}`);
      data = await res.json();
    } catch (err) {
      throw new Error(
        `Error al descargar página ${page}: ${(err as Error).message}`,
      );
    }
    if (!data?.products?.length) break;
    for (const p of data.products) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      products.push(normalize(p));
    }
    event.sender.send('catalog:refresh-progress', {
      page,
      found: products.length,
    });
  }
  if (products.length === 0) {
    throw new Error('No se pudo descargar ningún producto');
  }
  const target = userDataCatalogPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(products), 'utf-8');
  return { ok: true, count: products.length, durationMs: Date.now() - start };
});

ipcMain.handle('print:document', async (_event, routePath: string) => {
  if (!mainWindow) throw new Error('Ventana principal no disponible');
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}#${routePath}`
    : `file://${path.join(__dirname, '../../dist/index.html')}#${routePath}`;

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  hardenWebContents(printWindow.webContents);

  const ready = new Promise<void>((resolve) => {
    const onReady = (event: Electron.IpcMainEvent) => {
      if (event.sender === printWindow.webContents) {
        ipcMain.removeListener('print:ready', onReady);
        resolve();
      }
    };
    ipcMain.on('print:ready', onReady);
    setTimeout(() => {
      ipcMain.removeListener('print:ready', onReady);
      resolve();
    }, 5000);
  });

  await printWindow.loadURL(rendererUrl);
  await ready;

  return new Promise<boolean>((resolve, reject) => {
    printWindow.webContents.print({ silent: false, printBackground: true }, (success, reason) => {
      printWindow.close();
      if (success) resolve(true);
      else reject(new Error(reason));
    });
  });
});
