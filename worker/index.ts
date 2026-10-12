import Anthropic from '@anthropic-ai/sdk';
import { devNoteText } from '../src/lib/devNotePrefix';

// Proxy tussen de app en de API's van OpenAI (spraak naar tekst), Anthropic
// (interpretatie) en waarneming.nl (gebiedsnamen). De API-sleutels blijven hier; de app stuurt alleen een
// toegangscode mee, zodat niet iedereen die de URL vindt ons tegoed opmaakt.
// Daarnaast bewaart de proxy wat testers delen (wandelingen, feedback,
// eventueel opnames) in KV, zodat de eigenaar het kan ophalen (/api/feedback).
//
// Toegangscodes: ACCESS_CODE is die van de eigenaar; ACCESS_CODES bevat er één
// per tester als JSON, `{"anna": "…", "piet": "…"}`. Zo kun je één tester
// afsluiten zonder de anderen, en zie je in de logs wie wat gebruikt.
// Testers die de eigenaar vanuit de app uitnodigt (scherm Developer) staan in
// KV (TESTERS), zie /api/testers; die werken op dezelfde manier.

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

/** KV-sleutel (in TESTERS) met alle uitgenodigde testers. */
const INVITED_KEY = 'invited';
/** KV-sleutel (in TESTERS) met de id's van feedback die de eigenaar verwerkt heeft. */
const PROCESSED_KEY = 'processed-notes';
/** Zoveel id's tegelijk als verwerkt markeren; ruim genoeg voor "alles". */
const MAX_PROCESSED_IDS = 1000;
/** Zelfde regel als bij het wissen van gedeelde gegevens (/api/feedback). */
const TESTER_NAME = /^[\w-]{1,32}$/;

interface InvitedTester {
  code: string;
  invitedAt: number;
}

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
      if (pathname === '/api/testers') {
        return await testers(request, env, tester);
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
  // Zekerheid per stukje tekst; whisper-1 kan dat niet
  if (model !== 'whisper-1') upstream.append('include[]', 'logprobs');

  const start = Date.now();
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: upstream,
  });

  const result = (await response.json()) as {
    text?: string;
    logprobs?: { logprob: number }[];
    error?: { message: string };
  };
  if (!response.ok) {
    return json(
      { error: result.error?.message ?? 'Fout bij OpenAI' },
      upstreamStatus(response.status),
    );
  }
  return json(
    { text: result.text ?? '', model, confidence: confidence(result.logprobs) },
    200,
    Date.now() - start,
  );
}

/**
 * Hoe zeker de spraakherkenning was, tussen 0 en 1: het meetkundig gemiddelde
 * van de kansen per stukje tekst. Echte uitspraken scoren 0,8–1; geritsel in
 * een broekzak (waar het model dan een vogel bij verzint) onder 0,3.
 */
function confidence(logprobs: { logprob: number }[] | undefined): number | undefined {
  if (!logprobs?.length) return undefined;
  const mean = logprobs.reduce((sum, token) => sum + token.logprob, 0) / logprobs.length;
  return Math.round(Math.exp(mean) * 1000) / 1000;
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
 * - GET /api/feedback/notes          alle feedback, met of hij verwerkt is (eigenaar)
 * - POST /api/feedback/processed { ids, processed }  feedback (niet) verwerkt (eigenaar)
 * - DELETE /api/feedback/tester?name=…  alles van één tester wissen (eigenaar)
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
  if (request.method === 'GET' && kind === 'notes') {
    return json({ notes: await sharedNotes(env) });
  }
  if (request.method === 'POST' && kind === 'processed') {
    const { ids, processed } = (await request.json()) as { ids?: unknown; processed?: unknown };
    const valid =
      Array.isArray(ids) &&
      ids.length <= MAX_PROCESSED_IDS &&
      ids.every((id) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id));
    if (!valid || typeof processed !== 'boolean') return json({ error: 'Ongeldig verzoek' }, 400);
    const done = await processedNotes(env);
    for (const id of ids) {
      if (processed) done.add(id);
      else done.delete(id);
    }
    await env.TESTERS.put(PROCESSED_KEY, JSON.stringify([...done]));
    return json({ ok: true });
  }
  if (request.method === 'DELETE' && kind === 'tester') {
    const name = url.searchParams.get('name') ?? '';
    if (!/^[\w-]+$/.test(name)) return json({ error: 'Ongeldige naam' }, 400);
    let deleted = 0;
    let cursor: string | undefined;
    do {
      const page = await env.FEEDBACK.list({ prefix: `${name}/`, cursor });
      await Promise.all(page.keys.map((k) => env.FEEDBACK.delete(k.name)));
      deleted += page.keys.length;
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json({ ok: true, deleted });
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

export interface SharedNote {
  id: string;
  tester: string;
  recordedAt: number;
  /** Zonder "feedback" of "dev note" ervoor */
  text: string;
  appVersion?: string;
  /** Naam van de wandeling; leeg bij losse feedback */
  sessionName?: string;
  processed: boolean;
}

/**
 * Alle feedback uit de gedeelde wandelingen, nieuwste eerst. Leest elke
 * gedeelde wandeling (zonder opnames); bij een handvol testers is dat genoeg.
 */
async function sharedNotes(env: WorkerEnv): Promise<SharedNote[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FEEDBACK.list({ cursor });
    keys.push(...page.keys.map((k) => k.name).filter((name) => name.includes('/sessions/')));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const done = await processedNotes(env);
  const notes = await Promise.all(
    keys.map(async (key) => {
      const data = await env.FEEDBACK.get<SharedSession>(key, 'json').catch(() => null);
      const tester = key.split('/')[0];
      return (data?.utterances ?? [])
        .filter((u) => u.kind === 'dev_note')
        .map((u) => ({
          id: u.id,
          tester,
          recordedAt: u.recordedAt,
          text: devNoteText(u.transcript ?? '') || (u.transcript ?? ''),
          appVersion: u.metrics?.appVersion ?? data?.appVersion,
          sessionName: data?.sessions?.[0]?.name,
          processed: done.has(u.id),
        }));
    }),
  );
  return notes.flat().sort((a, b) => b.recordedAt - a.recordedAt);
}

/** Wat de app deelt (src/lib/share.ts), voor zover de proxy het leest. */
interface SharedSession {
  appVersion?: string;
  sessions?: { name?: string }[];
  utterances?: {
    id: string;
    recordedAt: number;
    kind?: string;
    transcript?: string;
    metrics?: { appVersion?: string };
  }[];
}

async function processedNotes(env: WorkerEnv): Promise<Set<string>> {
  return new Set((await env.TESTERS.get<string[]>(PROCESSED_KEY, 'json')) ?? []);
}

/**
 * Testers beheren vanuit de app (alleen de eigenaar). Uitgenodigde testers
 * staan als één JSON-object in KV: `{ "anna": { code, invitedAt } }`. Testers
 * uit het geheim ACCESS_CODES (scripts/tester.mjs) komen ook in de lijst, maar
 * zijn hier niet te wijzigen.
 *
 * - GET /api/testers               alle testers
 * - POST /api/testers  { name }    nieuwe tester; geeft de code terug
 * - DELETE /api/testers?name=…     uitgenodigde tester afsluiten
 */
async function testers(request: Request, env: WorkerEnv, tester: string): Promise<Response> {
  if (tester !== OWNER) return json({ error: 'Alleen voor de eigenaar' }, 403);
  const invited = await invitedTesters(env);

  if (request.method === 'GET') {
    const fromSecret = secretCodes(env)
      .filter(([name]) => name !== OWNER)
      .map(([name]) => ({ name, source: 'secret' as const }));
    const fromApp = Object.entries(invited).map(([name, { code, invitedAt }]) => ({
      name,
      source: 'app' as const,
      code,
      invitedAt,
    }));
    return json({ testers: [...fromSecret, ...fromApp] });
  }
  if (request.method === 'POST') {
    const { name } = (await request.json()) as { name?: unknown };
    if (typeof name !== 'string' || !TESTER_NAME.test(name)) {
      return json({ error: 'Naam zonder spaties of accenten, hooguit 32 tekens' }, 400);
    }
    const taken = name === OWNER || name in invited || secretCodes(env).some(([n]) => n === name);
    if (taken) return json({ error: `${name} bestaat al` }, 409);
    // 24 tekens, veilig in een URL; zelfde als scripts/tester.mjs
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const code = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    invited[name] = { code, invitedAt: Date.now() };
    await env.TESTERS.put(INVITED_KEY, JSON.stringify(invited));
    return json({ name, code });
  }
  if (request.method === 'DELETE') {
    const name = new URL(request.url).searchParams.get('name') ?? '';
    if (!(name in invited)) return json({ error: 'Niet gevonden' }, 404);
    delete invited[name];
    await env.TESTERS.put(INVITED_KEY, JSON.stringify(invited));
    return json({ ok: true });
  }
  return json({ error: 'Niet gevonden' }, 404);
}

async function invitedTesters(env: WorkerEnv): Promise<Record<string, InvitedTester>> {
  return (await env.TESTERS.get<Record<string, InvitedTester>>(INVITED_KEY, 'json')) ?? {};
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
  if (!response.ok)
    return json({ error: 'Fout bij waarneming.nl' }, upstreamStatus(response.status));

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

/** Naam per toegangscode, uit de geheimen en de uitgenodigde testers in KV. */
async function accessCodes(env: WorkerEnv): Promise<[name: string, code: string][]> {
  const codes = secretCodes(env);
  try {
    for (const [name, { code }] of Object.entries(await invitedTesters(env))) {
      if (code && name !== OWNER) codes.push([name, code]);
    }
  } catch (error) {
    // Dan werken de geheimen nog wel
    console.error('Testers uit KV niet te lezen', error);
  }
  return codes;
}

/** Naam per toegangscode, uit ACCESS_CODE (de eigenaar) en ACCESS_CODES. */
function secretCodes(env: WorkerEnv): [name: string, code: string][] {
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
  for (const [name, expected] of await accessCodes(env)) {
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
