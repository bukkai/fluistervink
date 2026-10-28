import Anthropic from '@anthropic-ai/sdk';
import { devNoteText } from '../src/lib/devNotePrefix';
import { bill, type BillingKeys } from './billing';
import {
  cleanDisplayName,
  findInstall,
  getInstall,
  INSTALL_ID,
  installIdFrom,
  installName,
  isInstallToken,
  listInstalls,
  putInstall,
  signInstallToken,
  verifyInstallToken,
  verifyPlayIntegrity,
  verifyTurnstile,
  type InstallSecrets,
} from './install';
import { recordUsage, sessionFrom, usageSince, type Usage } from './usage';

// Proxy tussen de app en de API's van OpenAI (spraak naar tekst), Anthropic
// (interpretatie) en waarneming.nl (gebiedsnamen). De API-sleutels blijven hier; de app stuurt alleen een
// toegangscode of het token van zijn installatie mee (worker/install.ts),
// zodat niet iedereen die de URL vindt ons tegoed opmaakt.
// Daarnaast bewaart de proxy wat testers delen (wandelingen, feedback,
// eventueel opnames) in KV, zodat de eigenaar het kan ophalen (/api/feedback),
// en telt hij het verbruik van OpenAI en Anthropic in D1 (/api/usage). Met
// een beheersleutel per aanbieder haalt hij ook de echte rekening op
// (/api/billing, worker/billing.ts).
//
// Toegangscodes: ACCESS_CODE is die van de eigenaar; ACCESS_CODES bevat er één
// per tester als JSON, `{"anna": "…", "piet": "…"}`. Zo kun je één tester
// afsluiten zonder de anderen, en zie je in de logs wie wat gebruikt.
// Testers die de eigenaar vanuit de app uitnodigt (scherm Developer) staan in
// KV (TESTERS), zie /api/testers; die werken op dezelfde manier.
// Zonder code meldt de app zich aan als installatie (/api/install); die heet
// dan "app-3f9a2b1c" en werkt verder ook als een tester.

interface Secrets {
  ACCESS_CODE?: string;
  ACCESS_CODES?: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}

type WorkerEnv = Env & Secrets & BillingKeys & InstallSecrets;

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
/**
 * Een verzoek van de app (systeemprompt met soortenlijst, tools, uitspraak) is
 * ~30 kB; dit is ruim, maar houdt enorme invoer op ons tegoed tegen.
 */
const MAX_MESSAGE_BYTES = 256 * 1024;
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
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Aanmelden kan zonder code: dat is juist waar het voor is
    if (pathname === '/api/install') {
      try {
        return await install(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: 'Interne fout in de proxy' }, 500);
      }
    }

    const tester = await authorize(request, env);
    if (!tester) {
      return json({ error: 'Ongeldige of ontbrekende toegangscode of installatie' }, 401);
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
      if (
        (pathname === '/api/transcribe' || pathname === '/api/messages') &&
        !(await withinLimit(env, tester))
      ) {
        return json({ error: 'Te veel verzoeken achter elkaar; probeer het zo opnieuw' }, 429);
      }
      if (pathname === '/api/transcribe' && request.method === 'POST') {
        return await transcribe(request, env, meter(request, env, ctx, tester));
      }
      if (pathname === '/api/messages' && request.method === 'POST') {
        return await messages(request, env, meter(request, env, ctx, tester));
      }
      if (pathname === '/api/usage' && request.method === 'GET') {
        return await usage(request, env, tester);
      }
      if (pathname === '/api/billing' && request.method === 'GET') {
        return await billing(env, tester);
      }
      if (pathname.startsWith('/api/feedback/')) {
        return await feedback(request, env, tester);
      }
      if (pathname === '/api/install/name' && request.method === 'PUT') {
        return await setDisplayName(request, env);
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
 * Snelheidslimiet op wat ons tegoed kost (AI_LIMIT in wrangler.jsonc), per
 * tester. De eigenaar valt erbuiten: de testset stuurt veel tegelijk.
 */
async function withinLimit(env: WorkerEnv, tester: string): Promise<boolean> {
  if (tester === OWNER) return true;
  return (await env.AI_LIMIT.limit({ key: tester })).success;
}

/**
 * Aanmelden zonder code (worker/install.ts).
 *
 * - GET /api/install   wat de app nodig heeft om te bewijzen dat hij echt is:
 *   de site key van Turnstile en het projectnummer voor Play Integrity
 * - POST /api/install  { id, integrity? , turnstile? }  geeft { token, tester }
 */
async function install(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method === 'GET') {
    return json({
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || undefined,
      playProjectNumber: env.PLAY_PROJECT_NUMBER || undefined,
    });
  }
  if (request.method !== 'POST') return json({ error: 'Niet gevonden' }, 404);
  if (!env.INSTALL_SECRET) return json({ error: 'Aanmelden staat uit' }, 503);

  // Turnstile en Play Integrity houden scripts tegen; dit nog per adres
  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await env.AI_LIMIT.limit({ key: `install:${ip}` })).success) {
    return json({ error: 'Te veel aanmeldingen achter elkaar; probeer het zo opnieuw' }, 429);
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    integrity?: unknown;
    turnstile?: unknown;
  };
  const id = typeof body.id === 'string' && INSTALL_ID.test(body.id) ? body.id : null;
  if (!id) return json({ error: 'Ongeldig id' }, 400);

  const existing = await getInstall(env.TESTERS, id);
  if (existing?.blocked) return json({ error: 'Deze installatie is afgesloten' }, 403);

  let via: 'play' | 'turnstile' | undefined;
  if (typeof body.integrity === 'string' && env.PLAY_SERVICE_ACCOUNT) {
    if (await verifyPlayIntegrity(body.integrity, id, env.PLAY_SERVICE_ACCOUNT)) via = 'play';
  } else if (typeof body.turnstile === 'string' && env.TURNSTILE_SECRET) {
    if (await verifyTurnstile(body.turnstile, env.TURNSTILE_SECRET, ip)) via = 'turnstile';
  }
  if (!via) return json({ error: 'De app kon niet bewijzen dat hij echt is' }, 403);

  const name = installName(id);
  if (!existing) {
    // De naam is het begin van het id, en dat kiest de app: twee installaties
    // met dezelfde naam zouden gedeelde gegevens en verbruik door elkaar halen.
    // De app kiest dan een nieuw id (install.ts).
    if (await findInstall(env.TESTERS, name)) return json({ error: 'Id al in gebruik' }, 409);
    await putInstall(env.TESTERS, id, { name, registeredAt: Date.now(), via });
  }
  console.log({ tester: name, path: '/api/install', via });
  return json({ token: await signInstallToken(id, env.INSTALL_SECRET), tester: name });
}

/**
 * PUT /api/install/name  { name }: de naam die de gebruiker bij Instellingen
 * opgaf, bij zijn installatie. Leeg haalt hem weg. Alleen voor installaties;
 * een tester met code heeft al een naam.
 */
async function setDisplayName(request: Request, env: WorkerEnv): Promise<Response> {
  const id = env.INSTALL_SECRET ? await installIdFrom(request, env.INSTALL_SECRET) : null;
  if (!id) return json({ error: 'Alleen voor een installatie zonder code' }, 403);
  const { name } = (await request.json().catch(() => ({}))) as { name?: unknown };
  const displayName = cleanDisplayName(name);
  if (displayName === null) return json({ error: 'Hooguit 40 tekens' }, 400);
  const record = await getInstall(env.TESTERS, id);
  if (!record) return json({ error: 'Niet gevonden' }, 404);
  await putInstall(env.TESTERS, id, { ...record, displayName: displayName || undefined });
  return json({ ok: true, displayName });
}

/** Telt het verbruik van één verzoek aan OpenAI of Anthropic. */
type Meter = (model: string, usage: Partial<Usage>) => void;

/**
 * Telt in D1 (worker/usage.ts) na het antwoord, zodat de app er niet op
 * wacht; lukt het niet, dan mislukt de uitspraak daar niet door. De app stuurt
 * het id van de wandeling mee in `X-Session`.
 */
function meter(request: Request, env: WorkerEnv, ctx: ExecutionContext, tester: string): Meter {
  const key = { tester, channel: env.CHANNEL, session: sessionFrom(request) };
  return (model, usage) =>
    ctx.waitUntil(
      recordUsage(env.USAGE, { ...key, model }, usage).catch((error) =>
        console.error('Verbruik niet opgeslagen', error),
      ),
    );
}

/**
 * Spraak naar tekst via OpenAI.
 * Verwacht multipart/form-data met `audio` (bestand), optioneel `model` en
 * `prompt` (bv. soortnamen, om de herkenning te sturen).
 */
async function transcribe(request: Request, env: WorkerEnv, meter: Meter): Promise<Response> {
  // Ruimte voor de andere velden (model, prompt met soortnamen) naast de audio
  if (declaredTooLarge(request, MAX_AUDIO_BYTES + 256 * 1024)) return tooLarge();
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
    usage?: TranscriptionUsage;
    error?: { message: string };
  };
  if (!response.ok) {
    return json(
      { error: result.error?.message ?? 'Fout bij OpenAI' },
      upstreamStatus(response.status),
    );
  }
  meter(model, transcriptionUsage(result.usage));
  return json(
    { text: result.text ?? '', model, confidence: confidence(result.logprobs) },
    200,
    Date.now() - start,
  );
}

/** De gpt-4o-modellen rekenen per token, whisper-1 per seconde audio. */
type TranscriptionUsage =
  | { type: 'tokens'; input_tokens: number; output_tokens: number }
  | { type: 'duration'; seconds: number };

function transcriptionUsage(usage: TranscriptionUsage | undefined): Partial<Usage> {
  if (usage?.type === 'duration') return { audioSeconds: usage.seconds };
  if (usage?.type === 'tokens') {
    return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
  }
  return {};
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
 * tools samen; de proxy laat alleen door wat de app zelf gebruikt (zie
 * checkMessage), zodat een toegangscode geen vrije toegang tot ons tegoed is.
 */
async function messages(request: Request, env: WorkerEnv, meter: Meter): Promise<Response> {
  const raw = await readBody(request, MAX_MESSAGE_BYTES);
  if (raw instanceof Response) return raw;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'Ongeldige JSON' }, 400);
  }

  if (!CLAUDE_MODELS.includes(parsed.model as string)) {
    return json({ error: `Model niet toegestaan: ${parsed.model}` }, 400);
  }
  const problem = checkMessage(parsed);
  if (problem) return json({ error: problem }, 400);
  const body = parsed as unknown as Anthropic.MessageCreateParamsNonStreaming;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const start = Date.now();
  const message = await client.messages.create({
    ...body,
    stream: false,
    max_tokens: Math.min(body.max_tokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
  });
  // Op de naam zoals de app hem stuurt, die ook in de prijstabel staat
  meter(body.model, {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
  });
  return json(message, 200, Date.now() - start);
}

/** Velden die de app meestuurt (src/lib/interpret.ts); andere worden geweigerd. */
const MESSAGE_FIELDS = new Set([
  'model',
  'max_tokens',
  'system',
  'messages',
  'tools',
  'tool_choice',
  'temperature',
  'output_config',
  'stream',
]);
/** Inhoud van een bericht: geen documenten of afbeeldingen (die kunnen een URL laten ophalen). */
const CONTENT_TYPES = new Set(['text', 'tool_use', 'tool_result']);

/**
 * Waarom dit verzoek niet door mag, of undefined. Alleen eigen tools (met een
 * input_schema): tools van Anthropic zelf, zoals web search, kosten per
 * gebruik en heeft de app niet nodig.
 */
function checkMessage(body: Record<string, unknown>): string | undefined {
  const extra = Object.keys(body).filter((key) => !MESSAGE_FIELDS.has(key));
  if (extra.length) return `Velden niet toegestaan: ${extra.join(', ')}`;

  const tools = body.tools ?? [];
  if (!Array.isArray(tools)) return 'Ongeldige tools';
  for (const tool of tools as { type?: unknown; input_schema?: unknown }[]) {
    if ((tool.type !== undefined && tool.type !== 'custom') || !tool.input_schema) {
      return 'Alleen eigen tools toegestaan';
    }
  }

  if (!Array.isArray(body.messages)) return 'Ongeldige messages';
  for (const message of body.messages as { content?: unknown }[]) {
    if (typeof message.content === 'string') continue;
    if (!Array.isArray(message.content)) return 'Ongeldige inhoud';
    for (const block of message.content as { type?: unknown; content?: unknown }[]) {
      if (!CONTENT_TYPES.has(String(block?.type))) return 'Inhoud niet toegestaan';
      // Een tool-resultaat kan zelf ook blokken bevatten; daar alleen tekst
      const inner = Array.isArray(block.content) ? (block.content as { type?: unknown }[]) : [];
      if (inner.some((part) => part?.type !== 'text')) return 'Inhoud niet toegestaan';
    }
  }
  return undefined;
}

/**
 * Verbruik per dag, tester, wandeling en model (worker/usage.ts), alleen voor
 * de eigenaar: `GET /api/usage?from=2026-09-01`.
 */
async function usage(request: Request, env: WorkerEnv, tester: string): Promise<Response> {
  if (tester !== OWNER) return json({ error: 'Alleen voor de eigenaar' }, 403);
  const from = new URL(request.url).searchParams.get('from') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return json({ error: 'Ongeldige datum' }, 400);
  return json({ rows: await usageSince(env.USAGE, from) });
}

/** De echte rekening van deze maand per aanbieder (worker/billing.ts), alleen voor de eigenaar. */
async function billing(env: WorkerEnv, tester: string): Promise<Response> {
  if (tester !== OWNER) return json({ error: 'Alleen voor de eigenaar' }, 403);
  const [openai, anthropic] = await Promise.all([
    bill(env.TESTERS, 'openai', env.OPENAI_ADMIN_KEY, env.OPENAI_PROJECT_ID),
    bill(env.TESTERS, 'anthropic', env.ANTHROPIC_ADMIN_KEY, env.ANTHROPIC_WORKSPACE_ID),
  ]);
  return json({ openai, anthropic });
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
    const body = await readBody(request, kind === 'sessions' ? MAX_SESSION_BYTES : MAX_AUDIO_BYTES);
    if (body instanceof Response) return body;
    if (body.byteLength === 0) return json({ error: 'Leeg' }, 400);
    // Alleen de typen die de app stuurt: de eigenaar haalt het later op, en
    // een tester mag niet bepalen hoe dat geopend wordt (bv. als HTML)
    const sent = request.headers.get('Content-Type') ?? '';
    const contentType = /^(application\/json|audio\/[\w.+-]+)(;.*)?$/.test(sent)
      ? sent
      : 'application/octet-stream';
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
    const { ids, processed } = (await request.json().catch(() => ({}))) as {
      ids?: unknown;
      processed?: unknown;
    };
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
      headers: {
        'Content-Type': metadata?.contentType ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      },
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
  const keys = await sharedSessionKeys(env);

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
          sessionName: data?.sessions?.[0]?.place?.name ?? data?.sessions?.[0]?.name,
          processed: done.has(u.id),
        }));
    }),
  );
  // Dezelfde feedback kan in twee bestanden staan (losse feedback onder de oude
  // vaste id én onder die van het apparaat, zie share.ts): één keer tonen
  const unique = new Map(notes.flat().map((n) => [n.id, n]));
  return [...unique.values()].sort((a, b) => b.recordedAt - a.recordedAt);
}

/** Wat de app deelt (src/lib/share.ts), voor zover de proxy het leest. */
interface SharedSession {
  appVersion?: string;
  /** `name` is de oude plek van de gebiedsnaam, nu `place.name` */
  sessions?: { name?: string; place?: { name?: string }; startedAt?: number; endedAt?: number }[];
  utterances?: {
    id: string;
    recordedAt: number;
    kind?: string;
    transcript?: string;
    metrics?: { appVersion?: string };
  }[];
}

/** Hoeveel een tester gedeeld heeft, om te zien of de app echt gebruikt wordt. */
export interface TesterUsage {
  walks: number;
  utterances: number;
  notes: number;
  /** Laatste uitspraak, feedback of einde van een wandeling */
  lastActivity?: number;
}

/**
 * Gebruik per tester, uit wat er gedeeld is (share.ts): alleen gestopte
 * wandelingen en losse feedback, en alleen van testers die delen aan hebben.
 */
async function testerUsage(env: WorkerEnv): Promise<Map<string, TesterUsage>> {
  const keys = await sharedSessionKeys(env);

  const files = await Promise.all(
    keys.map(async (key) => ({
      tester: key.split('/')[0],
      data: await env.FEEDBACK.get<SharedSession>(key, 'json').catch(() => null),
    })),
  );
  type Entry = { walks: number; utterances: Map<string, boolean>; lastActivity?: number };
  const perTester = new Map<string, Entry>();
  for (const { tester, data } of files) {
    const entry: Entry = perTester.get(tester) ?? { walks: 0, utterances: new Map() };
    perTester.set(tester, entry);
    entry.walks += data?.sessions?.length ?? 0;
    const times = [
      ...(data?.utterances ?? []).map((u) => u.recordedAt),
      ...(data?.sessions ?? []).map((s) => s.endedAt ?? s.startedAt ?? 0),
    ];
    // Op id, want losse feedback kan in twee bestanden staan
    for (const u of data?.utterances ?? []) entry.utterances.set(u.id, u.kind === 'dev_note');
    if (times.length) entry.lastActivity = Math.max(entry.lastActivity ?? 0, ...times);
  }

  return new Map(
    [...perTester].map(([tester, { walks, utterances, lastActivity }]) => {
      const notes = [...utterances.values()].filter(Boolean).length;
      return [
        tester,
        {
          walks,
          utterances: utterances.size - notes,
          notes,
          lastActivity: lastActivity || undefined,
        },
      ];
    }),
  );
}

/** Sleutels van alle gedeelde wandelingen (`<tester>/sessions/<id>`), zonder opnames. */
async function sharedSessionKeys(env: WorkerEnv): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FEEDBACK.list({ cursor });
    keys.push(...page.keys.map((k) => k.name).filter((name) => name.includes('/sessions/')));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function processedNotes(env: WorkerEnv): Promise<Set<string>> {
  return new Set((await env.TESTERS.get<string[]>(PROCESSED_KEY, 'json')) ?? []);
}

/**
 * Testers beheren vanuit de app (alleen de eigenaar). Uitgenodigde testers
 * staan als één JSON-object in KV: `{ "anna": { code, invitedAt } }`. Testers
 * uit het geheim ACCESS_CODES (scripts/tester.mjs) komen ook in de lijst, maar
 * zijn hier niet te wijzigen. Installaties zonder code (/api/install) staan er
 * ook in, en zijn net zo af te sluiten.
 *
 * - GET /api/testers               alle testers en installaties
 * - POST /api/testers  { name }    nieuwe tester; geeft de code terug
 * - DELETE /api/testers?name=…     uitgenodigde tester of installatie afsluiten
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
    const fromInstall = (await listInstalls(env.TESTERS)).map(
      ({ name, registeredAt, via, blocked, displayName }) => ({
        name,
        source: 'install' as const,
        invitedAt: registeredAt,
        via,
        blocked: blocked || undefined,
        displayName,
      }),
    );
    const usage = await testerUsage(env);
    return json({
      testers: [...fromSecret, ...fromApp, ...fromInstall].map((t) => ({
        ...t,
        usage: usage.get(t.name),
      })),
    });
  }
  if (request.method === 'POST') {
    const { name } = (await request.json()) as { name?: unknown };
    if (typeof name !== 'string' || !TESTER_NAME.test(name)) {
      return json({ error: 'Naam zonder spaties of accenten, hooguit 32 tekens' }, 400);
    }
    if (name.startsWith('app-')) {
      return json({ error: 'Namen met "app-" zijn voor installaties zonder code' }, 400);
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
    if (name.startsWith('app-')) {
      // Het token blijft geldig, maar authorize() weigert het daarna
      const found = await findInstall(env.TESTERS, name);
      if (!found) return json({ error: 'Niet gevonden' }, 404);
      const { id, ...record } = found;
      await putInstall(env.TESTERS, id, { ...record, blocked: true });
      return json({ ok: true });
    }
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

  if (isInstallToken(code)) {
    if (!env.INSTALL_SECRET) return null;
    const id = await verifyInstallToken(code, env.INSTALL_SECRET);
    if (!id) return null;
    try {
      if ((await getInstall(env.TESTERS, id))?.blocked) return null;
    } catch (error) {
      // KV even niet te lezen: het token zelf is geldig
      console.error('Installatie niet te lezen', error);
    }
    return installName(id);
  }

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
 * Leest de body, maar niet als die groter is dan `limit`: volgens de
 * Content-Length al vóór het inlezen, anders (zonder die header) erna.
 */
async function readBody(request: Request, limit: number): Promise<ArrayBuffer | Response> {
  if (declaredTooLarge(request, limit)) return tooLarge();
  const body = await request.arrayBuffer();
  return body.byteLength > limit ? tooLarge() : body;
}

function declaredTooLarge(request: Request, limit: number): boolean {
  return Number(request.headers.get('Content-Length') ?? 0) > limit;
}

function tooLarge(): Response {
  return json({ error: 'Te groot' }, 413);
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
