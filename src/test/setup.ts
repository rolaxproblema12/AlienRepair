import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

(window as unknown as { alien?: unknown }).alien = {
  openExternal: vi.fn().mockResolvedValue(undefined),
  openWhatsApp: vi.fn().mockResolvedValue(undefined),
  printDocument: vi.fn().mockResolvedValue(undefined),
  notifyPrintReady: vi.fn(),
  onAuthDeepLink: vi.fn().mockReturnValue(() => {}),
};
