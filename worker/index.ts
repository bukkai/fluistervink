import Anthropic from '@anthropic-ai/sdk';

// Proxy tussen de app en de API's van OpenAI (spraak naar tekst), Anthropic
// (interpretatie) en waarneming.nl (gebiedsnamen). De API-sleutels blijven hier; de app stuurt alleen een
// toegangscode mee, zodat niet iedereen die de URL vindt ons tegoed opmaakt.
// Daarnaast bewaart de proxy wat testers delen (wandelingen, feedback,
// eventueel opnames) in KV, zodat de eigenaar het kan ophalen (/api/feedback).
//
// Toegangscodes: ACCESS_CODE is die van de eigenaar; ACCESS_CODES bevat er één
// per tester als JSON, `{"anna": "…", "piet": "…"}`. Zo kun je één tester
// afsluiten zonder de anderen, en zie je in de logs wie wat gebruikt.

interface Secrets {
  ACCESS_CODE?: string;
  ACCESS_CODES?: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

type WorkerEnv = Env & Secrets;

/** Naam van de eigenaar (ACCESS_CODE); alleen die mag gedeelde gegevens ophalen. */
const OWNER = 'eigenaar';

// Alleen deze modellen mogen via de proxy worden aangeroepen. Meerdere, zodat
// we ze met de testset kunnen vergelijken.
const TRANSCRIBE_MODELS = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'];
const CLAUDE_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];

/** Bovengrens voor uitvoer: een uitspraak levert maar een paar tool calls op. */
const MAX_OUTPUT_TOKENS = 4096;
/** Een uitspraak duurt seconden; 10 MB is ruim en voorkomt misbruik. */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** Een gedeelde wandeling zonder opnames is hooguit een paar honderd kB. */
const MAX_SESSION_BYTES = 5 * 1024 * 1024;

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    const tester = await authorize(request, env);
    if (!tester) {
      return json({ error: 'Ongeldige of ontbrekende toegangscode' }, 401);
    }
    // In Workers Logs (observability), om gebruik per tester te kunnen zien
    console.log({ tester, path: pathname });

    try {
      if (pathname === '/api/ping' && request.method === 'GET') {
        return json({ ok: true, tester });
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
      if (pathname.startsWith('/api/feedback/')) {
        return await feedback(request, env, tester);
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
 * Gedeelde gegevens van testers, in KV onder `<tester>/sessions/<id>` (JSON)
 * en `<tester>/audio/<id>` (opname van een uitspraak). Een tester kan alleen
 * schrijven, en alleen onder zijn eigen naam; de eigenaar kan ook lezen
 * (scripts/feedback.mjs).
 *
 * - PUT /api/feedback/sessions/<id>  wandeling als JSON
 * - PUT /api/feedback/audio/<id>     opname
 * - GET /api/feedback/list?cursor=…  sleutels met metadata (eigenaar)
 * - GET /api/feedback/file?key=…     één bestand (eigenaar)
 */
async function feedback(request: Request, env: WorkerEnv, tester: string): Promise<Response> {
  const url = new URL(request.url);
  const [, , , kind, id] = url.pathname.split('/');

  if (request.method === 'PUT' && (kind === 'sessions' || kind === 'audio')) {
    if (!id || !/^[\w-]{1,64}$/.test(id)) return json({ error: 'Ongeldige id' }, 400);
    const limit = kind === 'sessions' ? MAX_SESSION_BYTES : MAX_AUDIO_BYTES;
    const body = await request.arrayBuffer();
    if (body.byteLength === 0) return json({ error: 'Leeg' }, 400);
    if (body.byteLength > limit) return json({ error: 'Te groot' }, 413);
    const contentType = request.headers.get('Content-Type') ?? 'application/octet-stream';
    await env.FEEDBACK.put(`${tester}/${kind}/${id}`, body, {
      metadata: { contentType, uploadedAt: Date.now(), bytes: body.byteLength },
    });
    return json({ ok: true });
  }

  if (tester !== OWNER) return json({ error: 'Alleen voor de eigenaar' }, 403);

  if (request.method === 'GET' && kind === 'list') {
    const result = await env.FEEDBACK.list({ cursor: url.searchParams.get('cursor') ?? undefined });
    return json({
      keys: result.keys.map((k) => ({ key: k.name, ...(k.metadata as object) })),
      cursor: result.list_complete ? undefined : result.cursor,
    });
  }
  if (request.method === 'GET' && kind === 'file') {
    const { value, metadata } = await env.FEEDBACK.getWithMetadata<{ contentType?: string }>(
      url.searchParams.get('key') ?? '',
      'arrayBuffer',
    );
    if (!value) return json({ error: 'Niet gevonden' }, 404);
    return new Response(value, {
      headers: { 'Content-Type': metadata?.contentType ?? 'application/octet-stream' },
    });
  }
  return json({ error: 'Niet gevonden' }, 404);
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

/** Naam per toegangscode, uit ACCESS_CODE (de eigenaar) en ACCESS_CODES. */
function accessCodes(env: WorkerEnv): [name: string, code: string][] {
  const codes: [string, string][] = [];
  if (env.ACCESS_CODE) codes.push([OWNER, env.ACCESS_CODE]);
  if (env.ACCESS_CODES) {
    try {
      const testers = JSON.parse(env.ACCESS_CODES) as Record<string, unknown>;
      for (const [name, code] of Object.entries(testers)) {
        // Een tester mag nooit als eigenaar binnenkomen
        if (typeof code === 'string' && code && name !== OWNER) codes.push([name, code]);
      }
    } catch {
      console.error('ACCESS_CODES is geen geldige JSON');
    }
  }
  return codes;
}

/**
 * Geeft de naam van de tester bij de toegangscode, of null. Vergelijkt in
 * constante tijd (via SHA-256-hashes van gelijke lengte) en loopt altijd alle
 * codes langs, zodat een code niet via responstijden te raden is.
 */
async function authorize(request: Request, env: WorkerEnv): Promise<string | null> {
  const header = request.headers.get('Authorization') ?? '';
  const code = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!code) return null;

  const encoder = new TextEncoder();
  const hash = (text: string) => crypto.subtle.digest('SHA-256', encoder.encode(text));
  const given = await hash(code);
  let match: string | null = null;
  for (const [name, expected] of accessCodes(env)) {
    if (crypto.subtle.timingSafeEqual(given, await hash(expected))) match ??= name;
  }
  return match;
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
