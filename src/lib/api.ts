// Client voor de proxy in worker/index.ts. De app meldt zich vanzelf aan als
// installatie (install.ts). Alleen de eigenaar heeft een toegangscode, één
// keer ingevuld bij Instellingen en daarna in localStorage bewaard, samen met
// de naam die de proxy erbij teruggeeft.

import type { Billing, UsageRow } from './costs';
import { forgetInstallToken, getInstallToken, register } from './install';
import type { ActivityRow } from './stats';

/** Naam die de proxy geeft bij de toegangscode van de eigenaar. */
export const OWNER = 'eigenaar';

const ACCESS_CODE_KEY = 'fluistervink.accessCode';
const TESTER_KEY = 'fluistervink.tester';

export function getAccessCode(): string {
  return localStorage.getItem(ACCESS_CODE_KEY) ?? '';
}

/** Leeg: geen code meer, de app gebruikt dan zijn installatie. */
export function setAccessCode(code: string): void {
  if (code.trim()) localStorage.setItem(ACCESS_CODE_KEY, code.trim());
  else localStorage.removeItem(ACCESS_CODE_KEY);
  // Hoort bij de vorige code; ping() vult hem opnieuw
  localStorage.removeItem(TESTER_KEY);
}

/**
 * "eigenaar" bij de toegangscode, anders de naam van de installatie
 * ("app-3f9a2b1c"), als bekend.
 */
export function getTester(): string | undefined {
  return localStorage.getItem(TESTER_KEY) ?? undefined;
}

const DISPLAY_NAME_KEY = 'fluistervink.displayName';

/** Naam die de gebruiker zelf opgaf (Instellingen), of ''. */
export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
}

/**
 * Geeft de proxy de eigen naam van deze installatie, zodat de ontwikkelaar
 * weet van wie gebruik en feedback komen. Leeg haalt hem weg.
 */
export async function setDisplayName(name: string): Promise<void> {
  const { displayName } = await request<{ displayName: string }>('/api/install/name', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (displayName) localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  else localStorage.removeItem(DISPLAY_NAME_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Zonder time-out kan één hangend verzoek de hele wachtrij ophouden. Een
 * uitspraak duurt normaal een paar seconden.
 */
const TIMEOUT_MS = 30_000;

/**
 * Een opname mag langer uploaden: een seconde extra per 50 kB, zodat ook een
 * lange opname bij zwak bereik (±50 kB/s omhoog) binnen de time-out past.
 */
const UPLOAD_BYTES_PER_EXTRA_S = 50_000;

/** Time-out voor de spraakherkenning, naar de grootte van de opname. */
export function transcribeTimeout(bytes: number): number {
  return TIMEOUT_MS + Math.ceil(bytes / UPLOAD_BYTES_PER_EXTRA_S) * 1000;
}

export interface Timing {
  /** Duur van het hele verzoek, gezien vanuit de app */
  requestMs: number;
  /** Tijd bij OpenAI/Anthropic, gemeten door de proxy (Server-Timing) */
  upstreamMs?: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await timedRequest<T>(path, init)).data;
}

async function timedRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<{ data: T; timing: Timing }> {
  const headers = new Headers(init.headers);
  const credential = await getCredential();
  headers.set('Authorization', `Bearer ${credential}`);

  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(`Time-out: geen antwoord binnen ${timeoutMs / 1000} s`, 0);
    }
    throw new ApiError(navigator.onLine ? 'Proxy niet bereikbaar' : 'Geen internetverbinding', 0);
  }
  const body = await response.json().catch(() => ({}));
  const timing: Timing = {
    requestMs: Math.round(performance.now() - start),
    upstreamMs: upstreamDuration(response),
  };
  if (!response.ok) {
    // Afgesloten of het geheim van de proxy veranderd: opnieuw aanmelden
    if (response.status === 401 && credential === getInstallToken()) forgetInstallToken();
    // Een oude testercode (die bestaan niet meer): weg ermee, en meteen
    // opnieuw als installatie, zodat de uitspraak niet mislukt. Niet bij een
    // net ingevulde code (Instellingen), die meldt zelf dat hij niet klopt.
    if (
      response.status === 401 &&
      credential === getAccessCode() &&
      getTester() &&
      getTester() !== OWNER
    ) {
      setAccessCode('');
      return timedRequest<T>(path, init, timeoutMs);
    }
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }
  return { data: body as T, timing };
}

/**
 * De toegangscode als die er is, anders het token van deze installatie; dat
 * wordt zo nodig eerst aangevraagd (install.ts).
 */
async function getCredential(): Promise<string> {
  const code = getAccessCode() || getInstallToken();
  if (code) return code;
  try {
    const { token, tester } = await register();
    localStorage.setItem(TESTER_KEY, tester);
    return token;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 0;
    throw new ApiError(error instanceof Error ? error.message : String(error), status);
  }
}

/** Leest `Server-Timing: upstream;dur=1234` uit de respons van de proxy. */
function upstreamDuration(response: Response): number | undefined {
  const match = /upstream;dur=([\d.]+)/.exec(response.headers.get('Server-Timing') ?? '');
  return match ? Math.round(Number(match[1])) : undefined;
}

/**
 * Controleert of de proxy bereikbaar is en de toegangscode klopt, en bewaart
 * de naam van de tester. Geeft die naam terug.
 */
export async function ping(): Promise<string | undefined> {
  const { tester } = await request<{ tester?: string }>('/api/ping');
  if (tester) localStorage.setItem(TESTER_KEY, tester);
  return tester;
}

export interface TranscribeOptions {
  model?: string;
  /** Tekst die de herkenning stuurt, bv. een lijst soortnamen */
  prompt?: string;
  /** Sessie waar de uitspraak bij hoort, voor het verbruik (zie sessionHeader) */
  sessionId?: string;
}

/**
 * De proxy telt het verbruik per sessie (kostenoverzicht op Developer).
 * Alleen het id; zonder (testset) telt het als "geen sessie".
 */
function sessionHeader(sessionId: string | undefined): HeadersInit {
  return sessionId ? { 'X-Session': sessionId } : {};
}

export async function transcribe(
  audio: Blob,
  { model, prompt, sessionId }: TranscribeOptions = {},
): Promise<{ data: { text: string; model: string; confidence?: number }; timing: Timing }> {
  const form = new FormData();
  // OpenAI herkent het formaat aan de extensie: "audio/webm;codecs=opus" → .webm
  const extension = /^audio\/(\w+)/.exec(audio.type)?.[1] ?? 'webm';
  form.set('audio', audio, `opname.${extension}`);
  if (model) form.set('model', model);
  if (prompt) form.set('prompt', prompt);
  return timedRequest(
    '/api/transcribe',
    { method: 'POST', headers: sessionHeader(sessionId), body: form },
    transcribeTimeout(audio.size),
  );
}

/** Stuurt een verzoek door naar de Messages API van Anthropic. */
export async function createMessage<T = unknown>(
  params: object,
  sessionId?: string,
): Promise<{ data: T; timing: Timing }> {
  return timedRequest('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeader(sessionId) },
    body: JSON.stringify(params),
  });
}

/**
 * Deelt een bestand met de ontwikkelaar (zie share.ts): `sessions/<id>` of
 * `audio/<id>`. De proxy bewaart het onder de naam van de tester.
 */
export async function putShared(path: string, body: Blob): Promise<void> {
  await request(`/api/feedback/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': body.type || 'application/octet-stream' },
    body,
  });
}

export interface Area {
  /** Gebieds-ID van waarneming.nl */
  id: number;
  name: string;
}

/** Het gebied van waarneming.nl waarin een punt ligt, of null als er geen is. */
export async function fetchArea(lat: number, lon: number): Promise<Area | null> {
  const { area } = await request<{ area: Area | null }>(
    `/api/area?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,
  );
  return area;
}

/** Verbruik van OpenAI en Anthropic vanaf `from` (alleen voor de eigenaar). */
export async function listUsage(from: string): Promise<UsageRow[]> {
  return (await request<{ rows: UsageRow[] }>(`/api/usage?from=${from}`)).rows;
}

/** Gebruik per dag en tester vanaf `from`, voor de statistieken (alleen voor de eigenaar). */
export async function listActivity(from: string): Promise<ActivityRow[]> {
  return (await request<{ rows: ActivityRow[] }>(`/api/stats?from=${from}`)).rows;
}

/** De echte rekening van OpenAI en Anthropic, deze maand (alleen voor de eigenaar). */
export async function fetchBilling(): Promise<Billing> {
  return request<Billing>('/api/billing');
}

/** Installatie in de proxy (worker/install.ts). */
export interface Tester {
  name: string;
  source: 'install';
  /** Aangemeld */
  invitedAt?: number;
  /** Hoe een installatie bewees dat hij echt is */
  via?: 'play' | 'turnstile';
  blocked?: boolean;
  /** Naam die een installatie zelf opgaf */
  displayName?: string;
  /** Laatste dag met een uitspraak ("2026-11-03"), ook zonder delen; uit het verbruik */
  lastUsed?: string;
  /** Wat de tester gedeeld heeft; leeg als er (nog) niets gedeeld is */
  usage?: {
    walks: number;
    utterances: number;
    notes: number;
    lastActivity?: number;
  };
}

/** Alle installaties (alleen voor de eigenaar). */
export async function listTesters(): Promise<Tester[]> {
  return (await request<{ testers: Tester[] }>('/api/testers')).testers;
}

/** Installatie afsluiten: het token werkt daarna niet meer. */
export async function removeTester(name: string): Promise<void> {
  await request(`/api/testers?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Een afgesloten installatie uit de lijst halen; hij blijft afgesloten. */
export async function hideTester(name: string): Promise<void> {
  await request(`/api/testers?name=${encodeURIComponent(name)}&hide=1`, { method: 'DELETE' });
}

/** Feedback van alle testers, zoals de proxy hem heeft (alleen voor de eigenaar). */
export interface SharedNote {
  id: string;
  tester: string;
  recordedAt: number;
  text: string;
  appVersion?: string;
  sessionName?: string;
  processed: boolean;
}

/** Alle gedeelde feedback, nieuwste eerst (alleen voor de eigenaar). */
export async function listSharedNotes(): Promise<SharedNote[]> {
  const { notes } = await request<{ notes: SharedNote[] }>('/api/feedback/notes');
  // Eén keer per id, ook als de proxy dezelfde feedback dubbel geeft: de lijst
  // op Developer is daarop gesleuteld en loopt anders vast
  return [...new Map(notes.map((n) => [n.id, n])).values()];
}

/** Feedback als (niet) verwerkt markeren (alleen voor de eigenaar). */
export async function markNotesProcessed(ids: string[], processed: boolean): Promise<void> {
  await request('/api/feedback/processed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, processed }),
  });
}
