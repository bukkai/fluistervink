import { devNoteText } from '../src/lib/devNotePrefix';
import { json, MAX_AUDIO_BYTES, OWNER, readBody } from './common';
import { guardShare } from './guard';

// Wat testers delen (sessies, feedback, eventueel opnames), in KV: de route
// /api/feedback en wat de proxy er zelf uit leest (feedback voor Developer,
// gebruik per tester voor de lijst met installaties).

/** Een gedeelde sessie zonder opnames is hooguit een paar honderd kB. */
const MAX_SESSION_BYTES = 5 * 1024 * 1024;

/** KV-sleutel (in TESTERS) met de id's van feedback die de eigenaar verwerkt heeft. */
const PROCESSED_KEY = 'processed-notes';
/**
 * KV-sleutel (in TESTERS) met de id's van feedback die de eigenaar gewist heeft:
 * die staat niet meer in de lijst. De gedeelde sessies zelf blijven (testset),
 * en een tester kan een sessie opnieuw delen, dus wissen is een lijst van id's.
 */
const DELETED_KEY = 'deleted-notes';
/** Zoveel id's tegelijk als verwerkt markeren of wissen; ruim genoeg voor "alles". */
const MAX_PROCESSED_IDS = 1000;

/**
 * Gedeelde gegevens van testers, in KV onder `<tester>/sessions/<id>` (JSON)
 * en `<tester>/audio/<id>` (opname van een uitspraak). Een tester kan alleen
 * schrijven, en alleen onder zijn eigen naam; de eigenaar kan ook lezen
 * (scripts/feedback.mjs).
 *
 * - PUT /api/feedback/sessions/<id>  sessie als JSON
 * - PUT /api/feedback/audio/<id>     opname
 * - GET /api/feedback/list?cursor=…  sleutels met metadata (eigenaar)
 * - GET /api/feedback/file?key=…     één bestand (eigenaar)
 * - GET /api/feedback/notes          alle feedback, met of hij verwerkt is (eigenaar)
 * - POST /api/feedback/processed { ids, processed }  feedback (niet) verwerkt (eigenaar)
 * - POST /api/feedback/delete { ids }  feedback van de lijst wissen (eigenaar)
 * - DELETE /api/feedback/tester?name=…  alles van één tester wissen (eigenaar)
 */
export async function feedback(request: Request, env: Env, tester: string): Promise<Response> {
  const url = new URL(request.url);
  const [, , , kind, id] = url.pathname.split('/');

  if (request.method === 'PUT' && (kind === 'sessions' || kind === 'audio')) {
    if (!id || !/^[\w-]{1,64}$/.test(id)) return json({ error: 'Ongeldige id' }, 400);
    const body = await readBody(request, kind === 'sessions' ? MAX_SESSION_BYTES : MAX_AUDIO_BYTES);
    if (body instanceof Response) return body;
    if (body.byteLength === 0) return json({ error: 'Leeg' }, 400);
    // Noodrem, en een grens op wat er per dag gedeeld wordt (guard.ts)
    const refused = await guardShare(env, tester, body.byteLength);
    if (refused) return refused;
    // Alleen de typen die de app stuurt: de eigenaar haalt het later op, en
    // een tester mag niet bepalen hoe dat geopend wordt (bv. als HTML)
    const sent = request.headers.get('Content-Type') ?? '';
    const contentType = /^(application\/json|audio\/[\w.+-]+)(;.*)?$/.test(sent)
      ? sent
      : 'application/octet-stream';
    // Bij een sessie meteen de telling voor de lijst met installaties
    // (testerUsage), zodat die het bestand niet hoeft te lezen
    const usage = kind === 'sessions' ? sharedUsage(parseShared(parseJson(body))) : undefined;
    await env.FEEDBACK.put(`${tester}/${kind}/${id}`, body, {
      metadata: { contentType, uploadedAt: Date.now(), bytes: body.byteLength, usage },
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
  if (request.method === 'POST' && (kind === 'processed' || kind === 'delete')) {
    const { ids, processed } = (await request.json().catch(() => ({}))) as {
      ids?: unknown;
      processed?: unknown;
    };
    const valid =
      Array.isArray(ids) &&
      ids.length <= MAX_PROCESSED_IDS &&
      ids.every((id) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id));
    if (!valid || (kind === 'processed' && typeof processed !== 'boolean')) {
      return json({ error: 'Ongeldig verzoek' }, 400);
    }
    const done = await processedNotes(env);
    if (kind === 'delete') {
      // Gewist hoeft niet meer als verwerkt te boeken: houdt die lijst klein
      const deleted = await noteIds(env, DELETED_KEY);
      for (const id of ids) {
        deleted.add(id);
        done.delete(id);
      }
      await env.TESTERS.put(DELETED_KEY, JSON.stringify([...deleted]));
    } else {
      for (const id of ids) {
        if (processed) done.add(id);
        else done.delete(id);
      }
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
  /** Naam van de sessie; leeg bij losse feedback */
  sessionName?: string;
  processed: boolean;
}

/**
 * Alle feedback uit de gedeelde sessies, nieuwste eerst. Leest elke
 * gedeelde sessie (zonder opnames); bij een handvol testers is dat genoeg.
 */
async function sharedNotes(env: Env): Promise<SharedNote[]> {
  const keys = await sharedSessionKeys(env);

  const done = await processedNotes(env);
  const deleted = await noteIds(env, DELETED_KEY);
  const notes = await Promise.all(
    keys.map(async (key) => {
      const data = await readShared(env, key);
      const tester = key.split('/')[0];
      return data.utterances
        .filter((u) => u.kind === 'dev_note' && !deleted.has(u.id))
        .map((u) => ({
          id: u.id,
          tester,
          recordedAt: u.recordedAt,
          text: devNoteText(u.transcript ?? '') || (u.transcript ?? ''),
          appVersion: u.metrics?.appVersion ?? (data.appVersion || undefined),
          sessionName: data.sessions[0]?.place?.name ?? data.sessions[0]?.name,
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

/**
 * Een gedeeld bestand, voor zover het de verwachte vorm heeft. Iedereen met
 * een browser kan delen (aanmelden zonder code), dus de inhoud is niet te
 * vertrouwen: één kapot bestand mag Developer niet voor alle testers laten
 * vastlopen. Wat niet klopt, telt niet mee.
 */
async function readShared(env: Env, key: string): Promise<Required<SharedSession>> {
  return parseShared(await env.FEEDBACK.get<SharedSession>(key, 'json').catch(() => null));
}

function parseJson(body: ArrayBuffer | Uint8Array): SharedSession | null {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as SharedSession | null;
  } catch {
    return null;
  }
}

function parseShared(data: SharedSession | null): Required<SharedSession> {
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const isObject = (value: unknown) => typeof value === 'object' && value !== null;
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  return {
    appVersion: text(data?.appVersion) ?? '',
    sessions: (list(data?.sessions).filter(isObject) as Record<string, unknown>[]).map((s) => ({
      name: text(s.name),
      place: { name: text((s.place as { name?: unknown } | null)?.name) },
      startedAt: number(s.startedAt),
      endedAt: number(s.endedAt),
    })),
    utterances: (list(data?.utterances).filter(isObject) as Record<string, unknown>[]).flatMap(
      (u) => {
        const id = text(u.id);
        const recordedAt = number(u.recordedAt);
        if (!id || recordedAt === undefined) return [];
        const appVersion = text((u.metrics as { appVersion?: unknown } | null)?.appVersion);
        return [
          {
            id,
            recordedAt,
            kind: text(u.kind),
            transcript: text(u.transcript),
            metrics: { appVersion },
          },
        ];
      },
    ),
  };
}

/** Hoeveel een tester gedeeld heeft, om te zien of de app echt gebruikt wordt. */
export interface TesterUsage {
  sessions: number;
  utterances: number;
  notes: number;
  /** Laatste uitspraak, feedback of einde van een sessie */
  lastActivity?: number;
}

/** Telling van één gedeeld bestand, uitgerekend bij het delen. */
export function sharedUsage(data: Required<SharedSession>): TesterUsage {
  const notes = data.utterances.filter((u) => u.kind === 'dev_note').length;
  const times = [
    ...data.utterances.map((u) => u.recordedAt),
    ...data.sessions.map((s) => s.endedAt ?? s.startedAt ?? 0),
  ];
  const lastActivity = times.length ? Math.max(...times) : 0;
  return {
    sessions: data.sessions.length,
    utterances: data.utterances.length - notes,
    notes,
    lastActivity: lastActivity || undefined,
  };
}

/** De telling in de metadata van een gedeeld bestand (sinds 25 nov), als hij er is. */
function usageFromMetadata(metadata: unknown): TesterUsage | undefined {
  const usage = (metadata as { usage?: Partial<TesterUsage> } | null)?.usage;
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
  const sessions = count(usage?.sessions);
  const utterances = count(usage?.utterances);
  const notes = count(usage?.notes);
  if (sessions === undefined || utterances === undefined || notes === undefined) return undefined;
  return { sessions, utterances, notes, lastActivity: count(usage?.lastActivity) || undefined };
}

/**
 * Gebruik per tester, uit wat er gedeeld is (share.ts): alleen gestopte
 * sessies en losse feedback, en alleen van testers die delen aan hebben.
 *
 * De telling per bestand staat sinds 25 nov in de metadata van de sleutel
 * (bij het delen uitgerekend), zodat de lijst alleen de sleutels leest en
 * niet elk bestand; dat werd met elke gedeelde sessie trager, tot de grens
 * van een Worker. Bestanden van daarvoor worden nog gelezen. Feedback die in
 * twee bestanden staat (losse feedback van vóór 25 nov, per tester en per
 * apparaat), telt alleen tussen gelezen bestanden één keer.
 */
export async function testerUsage(env: Env): Promise<Map<string, TesterUsage>> {
  const keys = await sharedSessionKeysWithMetadata(env);

  type Entry = {
    sessions: number;
    utterances: number;
    notes: number;
    /** Uit gelezen bestanden: op id, want losse feedback kan in twee bestanden staan */
    read: Map<string, boolean>;
    lastActivity: number;
  };
  const perTester = new Map<string, Entry>();
  const entryFor = (tester: string): Entry => {
    let entry = perTester.get(tester);
    if (!entry) {
      entry = { sessions: 0, utterances: 0, notes: 0, read: new Map(), lastActivity: 0 };
      perTester.set(tester, entry);
    }
    return entry;
  };

  const add = (entry: Entry, usage: TesterUsage) => {
    entry.sessions += usage.sessions;
    entry.utterances += usage.utterances;
    entry.notes += usage.notes;
    entry.lastActivity = Math.max(entry.lastActivity, usage.lastActivity ?? 0);
  };
  const older: string[] = [];
  for (const { name, metadata } of keys) {
    const usage = usageFromMetadata(metadata);
    if (usage) add(entryFor(name.split('/')[0]), usage);
    else older.push(name);
  }
  const files = await Promise.all(
    older.map(async (key) => ({ tester: key.split('/')[0], data: await readShared(env, key) })),
  );
  for (const { tester, data } of files) {
    const entry = entryFor(tester);
    const { lastActivity } = sharedUsage(data);
    entry.sessions += data.sessions.length;
    entry.lastActivity = Math.max(entry.lastActivity, lastActivity ?? 0);
    for (const u of data.utterances) entry.read.set(u.id, u.kind === 'dev_note');
  }

  return new Map(
    [...perTester].map(([tester, { sessions, utterances, notes, read, lastActivity }]) => {
      const readNotes = [...read.values()].filter(Boolean).length;
      return [
        tester,
        {
          sessions,
          utterances: utterances + read.size - readNotes,
          notes: notes + readNotes,
          lastActivity: lastActivity || undefined,
        },
      ];
    }),
  );
}

/** Sleutels van alle gedeelde sessies (`<tester>/sessions/<id>`), zonder opnames. */
async function sharedSessionKeys(env: Env): Promise<string[]> {
  return (await sharedSessionKeysWithMetadata(env)).map((k) => k.name);
}

async function sharedSessionKeysWithMetadata(
  env: Env,
): Promise<{ name: string; metadata: unknown }[]> {
  const keys: { name: string; metadata: unknown }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FEEDBACK.list({ cursor });
    keys.push(...page.keys.filter((k) => k.name.includes('/sessions/')));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

function processedNotes(env: Env): Promise<Set<string>> {
  return noteIds(env, PROCESSED_KEY);
}

async function noteIds(env: Env, key: string): Promise<Set<string>> {
  return new Set((await env.TESTERS.get<string[]>(key, 'json')) ?? []);
}
