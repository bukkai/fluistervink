import { db } from './db';

// Gebeurtenissenlog voor de ontwikkelfase: alles wat helpt om later te
// begrijpen wat er gebeurde (fouten, app op de achtergrond, geen netwerk,
// mislukte pogingen). Blijft lokaal; gaat mee in de JSON-export.

export const APP_VERSION = __APP_VERSION__;

export interface LogEvent {
  id?: number;
  at: number;
  type: string;
  sessionId?: string;
  utteranceId?: string;
  data?: unknown;
}

/** Schrijft een gebeurtenis weg. Loggen mag de app nooit laten vastlopen. */
export function logEvent(
  type: string,
  data?: unknown,
  ids: { sessionId?: string; utteranceId?: string } = {},
): void {
  db.events.add({ at: Date.now(), type, ...ids, data }).catch(() => {});
}

/** Laatste moment waarop de app naar de achtergrond ging. */
let lastHiddenAt = document.hidden ? Date.now() : 0;

/**
 * Was de app sinds `since` (even) op de achtergrond? Chrome op Android
 * pauzeert dan de pagina, en daarmee de wachtrij.
 */
export function wasHiddenSince(since: number): boolean {
  return document.hidden || lastHiddenAt >= since;
}

/** Eén keer bij het opstarten aanroepen. */
export function startLogging(): void {
  logEvent('app_start', {
    version: APP_VERSION,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    standalone: matchMedia('(display-mode: standalone)').matches,
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) lastHiddenAt = Date.now();
    logEvent(document.hidden ? 'hidden' : 'visible');
  });
  window.addEventListener('online', () => logEvent('online'));
  window.addEventListener('offline', () => logEvent('offline'));

  window.addEventListener('error', (event) =>
    logEvent('error', { message: event.message, stack: event.error?.stack }),
  );
  window.addEventListener('unhandledrejection', (event) =>
    logEvent('error', {
      message: String(event.reason?.message ?? event.reason),
      stack: event.reason?.stack,
    }),
  );
}
