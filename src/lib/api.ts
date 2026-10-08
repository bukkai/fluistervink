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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${getAccessCode()}`);

  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
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
): Promise<{ text: string; model: string }> {
  const form = new FormData();
  form.set('audio', audio, 'opname.webm');
  if (model) form.set('model', model);
  if (prompt) form.set('prompt', prompt);
  return request('/api/transcribe', { method: 'POST', body: form });
}

/** Stuurt een verzoek door naar de Messages API van Anthropic. */
export async function createMessage<T = unknown>(params: object): Promise<T> {
  return request('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
