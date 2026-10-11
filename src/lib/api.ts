// Client voor de proxy in worker/index.ts. De toegangscode wordt één keer
// ingevuld (of via een uitnodigingslink meegegeven) en daarna in localStorage
// bewaard, samen met de naam van de tester die de proxy erbij teruggeeft.

const ACCESS_CODE_KEY = 'fluistervink.accessCode';
const TESTER_KEY = 'fluistervink.tester';

export function getAccessCode(): string {
  return localStorage.getItem(ACCESS_CODE_KEY) ?? '';
}

export function setAccessCode(code: string): void {
  localStorage.setItem(ACCESS_CODE_KEY, code.trim());
  // Hoort bij de vorige code; ping() vult hem opnieuw
  localStorage.removeItem(TESTER_KEY);
}

/** Naam van de tester bij de toegangscode ("eigenaar", "anna"), als bekend. */
export function getTester(): string | undefined {
  return localStorage.getItem(TESTER_KEY) ?? undefined;
}

const INVITE_KEY = 'fluistervink.invite';

/**
 * Uitnodigingslink: `https://…/#code=abc123`. Bewaart de code, haalt hem uit
 * de adresbalk en gaat naar het hoofdscherm, dat een welkom toont (zie
 * takeInvite). Na het `#` gaat de code niet mee naar de server en komt hij
 * niet in logs terecht.
 */
export function acceptInviteLink(): void {
  // Ook als er iets vóór staat, zoals "#instellingen/#code=…" (met de hand
  // aan een gekopieerd adres geplakt).
  const code = /(?:^|[#/&])code=([^&#/]+)/.exec(location.hash)?.[1];
  if (!code) return;
  setAccessCode(decodeURIComponent(code));
  sessionStorage.setItem(INVITE_KEY, '1');
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}

/** True (één keer) als de app net via een uitnodigingslink is geopend. */
export function takeInvite(): boolean {
  const invited = sessionStorage.getItem(INVITE_KEY) === '1';
  sessionStorage.removeItem(INVITE_KEY);
  return invited;
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
): Promise<{ data: T; timing: Timing }> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getAccessCode()}`);

  const start = performance.now();
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(`Time-out: geen antwoord binnen ${TIMEOUT_MS / 1000} s`, 0);
    }
    throw new ApiError(navigator.onLine ? 'Proxy niet bereikbaar' : 'Geen internetverbinding', 0);
  }
  const body = await response.json().catch(() => ({}));
  const timing: Timing = {
    requestMs: Math.round(performance.now() - start),
    upstreamMs: upstreamDuration(response),
  };
  if (!response.ok) {
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }
  return { data: body as T, timing };
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
}

export async function transcribe(
  audio: Blob,
  { model, prompt }: TranscribeOptions = {},
): Promise<{ data: { text: string; model: string }; timing: Timing }> {
  const form = new FormData();
  // OpenAI herkent het formaat aan de extensie: "audio/webm;codecs=opus" → .webm
  const extension = /^audio\/(\w+)/.exec(audio.type)?.[1] ?? 'webm';
  form.set('audio', audio, `opname.${extension}`);
  if (model) form.set('model', model);
  if (prompt) form.set('prompt', prompt);
  return timedRequest('/api/transcribe', { method: 'POST', body: form });
}

/** Stuurt een verzoek door naar de Messages API van Anthropic. */
export async function createMessage<T = unknown>(
  params: object,
): Promise<{ data: T; timing: Timing }> {
  return timedRequest('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

/**
 * Tester in de proxy: uitgenodigd vanuit de app (`app`, met code) of via
 * `npm run tester` in het geheim ACCESS_CODES (`secret`, alleen de naam).
 */
export interface Tester {
  name: string;
  source: 'app' | 'secret';
  code?: string;
  invitedAt?: number;
}

/** Alle testers (alleen voor de eigenaar). */
export async function listTesters(): Promise<Tester[]> {
  return (await request<{ testers: Tester[] }>('/api/testers')).testers;
}

/** Nieuwe tester met een eigen toegangscode (alleen voor de eigenaar). */
export async function addTester(name: string): Promise<{ name: string; code: string }> {
  return request('/api/testers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

/** Uitgenodigde tester afsluiten: de code werkt daarna niet meer. */
export async function removeTester(name: string): Promise<void> {
  await request(`/api/testers?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
}

/** Uitnodigingslink voor een code, op het adres waar de app nu draait. */
export function inviteLink(code: string): string {
  return `${location.origin}/#code=${code}`;
}
