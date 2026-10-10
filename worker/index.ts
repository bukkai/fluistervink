import Anthropic from '@anthropic-ai/sdk';

// Proxy tussen de app en de API's van OpenAI (spraak naar tekst), Anthropic
// (interpretatie) en waarneming.nl (gebiedsnamen). De API-sleutels blijven hier; de app stuurt alleen een
// toegangscode mee, zodat niet iedereen die de URL vindt ons tegoed opmaakt.

interface Secrets {
  ACCESS_CODE: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

type WorkerEnv = Env & Secrets;

// Alleen deze modellen mogen via de proxy worden aangeroepen. Meerdere, zodat
// we ze met de testset kunnen vergelijken.
const TRANSCRIBE_MODELS = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'];
const CLAUDE_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];

/** Bovengrens voor uitvoer: een uitspraak levert maar een paar tool calls op. */
const MAX_OUTPUT_TOKENS = 4096;
/** Een uitspraak duurt seconden; 10 MB is ruim en voorkomt misbruik. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!(await isAuthorized(request, env))) {
      return json({ error: 'Ongeldige of ontbrekende toegangscode' }, 401);
    }

    try {
      if (pathname === '/api/ping' && request.method === 'GET') {
        return json({ ok: true });
      }
      if (pathname === '/api/area' && request.method === 'GET') {
        return await area(request);
      }
      if (pathname === '/api/transcribe' && request.method === 'POST') {
        return await transcribe(request, env);
      }
      if (pathname === '/api/messages' && request.method === 'POST') {
        return await messages(request, env);
      }
      return json({ error: 'Niet gevonden' }, 404);
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return json({ error: error.message }, upstreamStatus(error.status));
      }
      console.error(error);
      return json({ error: 'Interne fout in de proxy' }, 500);
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

/**
 * Spraak naar tekst via OpenAI.
 * Verwacht multipart/form-data met `audio` (bestand), optioneel `model` en
 * `prompt` (bv. soortnamen, om de herkenning te sturen).
 */
async function transcribe(request: Request, env: WorkerEnv): Promise<Response> {
  const form = await request.formData();
  const audio = form.get('audio');
  const model = String(form.get('model') ?? TRANSCRIBE_MODELS[0]);
  const prompt = form.get('prompt');

  if (!(audio instanceof File)) return json({ error: 'Geen audio meegestuurd' }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: 'Audio te groot' }, 413);
  if (!TRANSCRIBE_MODELS.includes(model)) {
    return json({ error: `Model niet toegestaan: ${model}` }, 400);
  }

  const upstream = new FormData();
  upstream.set('file', audio);
  upstream.set('model', model);
  upstream.set('language', 'nl');
  upstream.set('response_format', 'json');
  if (typeof prompt === 'string' && prompt) upstream.set('prompt', prompt);

  const start = Date.now();
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: upstream,
  });

  const result = (await response.json()) as { text?: string; error?: { message: string } };
  if (!response.ok) {
    return json({ error: result.error?.message ?? 'Fout bij OpenAI' }, upstreamStatus(response.status));
  }
  return json({ text: result.text ?? '', model }, 200, Date.now() - start);
}

/**
 * Doorgeefluik naar de Messages API van Anthropic. De app stelt de prompt en
 * tools samen; de proxy controleert alleen het model en de uitvoerlimiet.
 */
async function messages(request: Request, env: WorkerEnv): Promise<Response> {
  const body = (await request.json()) as Anthropic.MessageCreateParamsNonStreaming;

  if (!CLAUDE_MODELS.includes(body.model)) {
    return json({ error: `Model niet toegestaan: ${body.model}` }, 400);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  const message = await client.messages.create({
    ...body,
    stream: false,
    max_tokens: Math.min(body.max_tokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
  });
  return json(message, 200, Date.now() - start);
}

/**
 * Het gebied van waarneming.nl ("Schoorlse Duinen") waarin een punt ligt.
 * Hun API is openbaar maar stuurt geen CORS-headers, daarom via de proxy.
 * Verwacht `?lat=…&lon=…`; geeft `{ area: { id, name } }` of `{ area: null }`.
 */
async function area(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = parseFloat(params.get('lat') ?? '');
  const lon = parseFloat(params.get('lon') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json({ error: 'Ongeldige coördinaten' }, 400);
  }

  const start = Date.now();
  const response = await fetch(
    `https://waarneming.nl/api/v1/locations/geojson/?coordinates=${lat},${lon}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) return json({ error: 'Fout bij waarneming.nl' }, upstreamStatus(response.status));

  // Alleen ID en naam; de omtrek van het gebied hebben we niet nodig
  const result = (await response.json()) as {
    features?: { properties: { id: number; title: string } }[];
  };
  const feature = result.features?.[0];
  return json(
    { area: feature ? { id: feature.properties.id, name: feature.properties.title } : null },
    200,
    Date.now() - start,
  );
}

/**
 * Vergelijkt de toegangscode in constante tijd (via SHA-256-hashes van gelijke
 * lengte), zodat de code niet via responstijden te raden is.
 */
async function isAuthorized(request: Request, env: WorkerEnv): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  const code = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!code || !env.ACCESS_CODE) return false;

  const encoder = new TextEncoder();
  const [given, expected] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(code)),
    crypto.subtle.digest('SHA-256', encoder.encode(env.ACCESS_CODE)),
  ]);
  return crypto.subtle.timingSafeEqual(given, expected);
}

/**
 * Een 401/403 van OpenAI of Anthropic betekent een probleem met onze eigen
 * API-sleutel, niet met de toegangscode van de app. Geef dat door als 502.
 */
function upstreamStatus(status: number | undefined): number {
  if (!status || status === 401 || status === 403) return 502;
  return status;
}

/**
 * @param upstreamMs Tijd bij OpenAI/Anthropic; gaat als Server-Timing-header
 *   mee, zodat de app kan zien waar de wachttijd zit.
 */
function json(data: unknown, status = 200, upstreamMs?: number): Response {
  const headers: HeadersInit =
    upstreamMs === undefined ? {} : { 'Server-Timing': `upstream;dur=${upstreamMs}` };
  return Response.json(data, { status, headers });
}
