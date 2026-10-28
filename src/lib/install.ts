import { logEvent } from './log';
import { isNativeApp, playIntegrityToken } from './native';

// Aanmelden zonder toegangscode (docs/plan-laagdrempelig.md). Bij de eerste
// keer openen maakt de app een id voor deze installatie en vraagt de proxy om
// een token (worker/install.ts). Eerst bewijst de app dat hij echt is: in de
// Android-app met Play Integrity (Google), anders of als dat niet lukt met
// Turnstile (Cloudflare), een controle die je meestal niet ziet. Id en token
// staan daarna in localStorage, net als een toegangscode.

const ID_KEY = 'fluistervink.installId';
const TOKEN_KEY = 'fluistervink.installToken';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Zolang wacht de app op Turnstile; een vraag aan de gebruiker telt mee. */
const TURNSTILE_TIMEOUT_MS = 60_000;

export function getInstallToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

/** Na een 401: het token werkt niet (meer), bij het volgende verzoek opnieuw aanmelden. */
export function forgetInstallToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function installId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

/**
 * Nonce voor Play Integrity: het id, base64 (web-safe, zonder opvulling).
 * Zelfde als integrityNonce in worker/install.ts.
 */
export function integrityNonce(id: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(id)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class InstallError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let pending: Promise<{ token: string; tester: string }> | undefined;

/**
 * Meldt deze installatie aan (één keer tegelijk) en geeft het token en de naam
 * ("app-3f9a2b1c"). Gooit een InstallError als het niet lukt; het volgende
 * verzoek probeert het dan opnieuw.
 */
export function register(): Promise<{ token: string; tester: string }> {
  pending ??= registerOnce()
    .catch((error) => {
      // Een andere installatie heeft al een id dat net zo begint (zelfde
      // naam): met een nieuw id opnieuw
      if (!(error instanceof InstallError) || error.status !== 409) throw error;
      localStorage.removeItem(ID_KEY);
      return registerOnce();
    })
    .finally(() => (pending = undefined));
  return pending;
}

async function registerOnce(): Promise<{ token: string; tester: string }> {
  const config = (await call('GET')) as { turnstileSiteKey?: string; playProjectNumber?: string };
  const id = installId();

  if (isNativeApp) {
    const integrity = await playIntegrityToken(integrityNonce(id), config.playProjectNumber);
    if (integrity) {
      try {
        return await stored(await call('POST', { id, integrity }));
      } catch (error) {
        // Bv. een debug-APK of een toestel zonder Google-goedkeuring
        logEvent('install_failed', { via: 'play', error: String(error) });
      }
    } else {
      logEvent('install_failed', { via: 'play', error: 'geen verklaring' });
    }
  }

  if (!config.turnstileSiteKey) {
    throw new InstallError('Aanmelden zonder code staat uit; vul een code in', 503);
  }
  const turnstile = await turnstileToken(config.turnstileSiteKey);
  return stored(await call('POST', { id, turnstile }));
}

function stored(result: unknown): { token: string; tester: string } {
  const { token, tester } = result as { token: string; tester: string };
  localStorage.setItem(TOKEN_KEY, token);
  logEvent('installed', { tester });
  return { token, tester };
}

async function call(method: 'GET' | 'POST', body?: object): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch('/api/install', {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new InstallError(
      navigator.onLine ? 'Proxy niet bereikbaar' : 'Geen internetverbinding',
      0,
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new InstallError(result.error ?? `HTTP ${response.status}`, response.status);
  }
  return result;
}

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let script: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = TURNSTILE_SCRIPT;
    element.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile ontbreekt'));
    element.onerror = () => {
      script = undefined;
      element.remove();
      reject(new InstallError('Controle van Cloudflare niet te laden', 0));
    };
    document.head.append(element);
  });
  return script;
}

/**
 * Een token van Turnstile. Meestal zonder dat de gebruiker iets ziet; vindt
 * Cloudflare het nodig, dan verschijnt onderaan het scherm een vakje om aan te
 * vinken (`interaction-only`, `.turnstile` in app.css).
 */
async function turnstileToken(sitekey: string): Promise<string> {
  const turnstile = await loadTurnstile();
  const container = document.createElement('div');
  container.className = 'turnstile';
  document.body.append(container);
  let widget: string | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new InstallError('Controle van Cloudflare duurde te lang', 0)),
        TURNSTILE_TIMEOUT_MS,
      );
      widget = turnstile.render(container, {
        sitekey,
        action: 'install',
        appearance: 'interaction-only',
        language: 'nl',
        callback: (token: string) => {
          clearTimeout(timer);
          resolve(token);
        },
        'error-callback': (code: string) => {
          clearTimeout(timer);
          reject(new InstallError(`Controle van Cloudflare mislukt (${code})`, 0));
          // Zelf afhandelen, anders probeert Turnstile het eindeloos opnieuw
          return true;
        },
      });
    });
  } finally {
    if (widget) turnstile.remove(widget);
    container.remove();
  }
}
