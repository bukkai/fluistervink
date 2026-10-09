// Client voor de proxy in worker/index.ts. De toegangscode wordt één keer
// ingevuld en daarna in localStorage bewaard.

const ACCESS_CODE_KEY = 'thijsse.accessCode';

export function getAccessCode(): string {
  return localStorage.getItem(ACCESS_CODE_KEY) ?? '';
}

export function setAccessCode(code: string): void {
  localStorage.setItem(ACCESS_CODE_KEY, code.trim());
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

/** Controleert of de proxy bereikbaar is en de toegangscode klopt. */
export async function ping(): Promise<void> {
  await request('/api/ping');
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
