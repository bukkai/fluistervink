// Wat de routes van de proxy delen (worker/index.ts, worker/feedback.ts).

/** Naam van de eigenaar (ACCESS_CODE); alleen die mag gedeelde gegevens ophalen. */
export const OWNER = 'eigenaar';

/** Een uitspraak duurt seconden; 10 MB is ruim en voorkomt misbruik. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Leest de body, maar niet als die groter is dan `limit`: volgens de
 * Content-Length al vóór het inlezen, anders (zonder die header) erna.
 */
export async function readBody(request: Request, limit: number): Promise<ArrayBuffer | Response> {
  if (declaredTooLarge(request, limit)) return tooLarge();
  const body = await request.arrayBuffer();
  return body.byteLength > limit ? tooLarge() : body;
}

export function declaredTooLarge(request: Request, limit: number): boolean {
  return Number(request.headers.get('Content-Length') ?? 0) > limit;
}

export function tooLarge(): Response {
  return json({ error: 'Te groot' }, 413);
}

/**
 * @param upstreamMs Tijd bij OpenAI/Anthropic; gaat als Server-Timing-header
 *   mee, zodat de app kan zien waar de wachttijd zit.
 */
export function json(data: unknown, status = 200, upstreamMs?: number): Response {
  const headers: HeadersInit =
    upstreamMs === undefined ? {} : { 'Server-Timing': `upstream;dur=${upstreamMs}` };
  return Response.json(data, { status, headers });
}
