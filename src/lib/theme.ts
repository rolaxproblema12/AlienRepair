import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'alien:theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  // Default: dark (la app nació dark; cambiamos solo si el user lo pide).
  return 'dark';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

// Subscriber-based store: cualquier consumidor que use useTheme() se
// actualiza cuando otro componente cambie el tema (por ejemplo, dos
// instances del toggle en la misma pantalla — improbable pero correcto).
const subscribers = new Set<() => void>();
let current: Theme = readStored();

function setTheme(next: Theme): void {
  if (current === next) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  applyTheme(next);
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function getSnapshot(): Theme {
  return current;
}

/**
 * Hook que devuelve el tema actual + setter. Persiste en localStorage,
 * sync entre tabs no se cubre (un Electron es 1 ventana). El tema se
 * aplica al `html` element vía la clase `dark`, lo que dispara las
 * variables CSS de globals.css.
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Asegurar que la clase esté aplicada en el primer mount. El script
  // inline de index.html ya lo hace, pero esto es un safety net.
  useEffect(() => {
    applyTheme(current);
  }, []);

  return {
    theme,
    setTheme,
    toggle: () => setTheme(current === 'dark' ? 'light' : 'dark'),
  };
}
