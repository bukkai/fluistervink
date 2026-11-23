// Anonieme cijfers per sessie (src/lib/summaries.ts): de proxy bewaart ze in
// D1 zonder installatie, sessie of tijdstip, alleen met de week waarin ze
// binnenkwamen en de week waarin de installatie begon (om groepen te
// vergelijken). Alleen bekende velden en waarden; al het andere wordt
// geweigerd, zodat niemand vrije tekst in de tabel kan zetten.

import { dayOf } from '../src/lib/costs';
import type { SessionSummary } from '../src/lib/summaries';
import { weekOf } from '../src/lib/stats';

const SCHEMA = `CREATE TABLE IF NOT EXISTS session_summaries (
  week TEXT NOT NULL,
  cohort TEXT NOT NULL,
  platform TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  utterances INTEGER NOT NULL,
  observations INTEGER NOT NULL,
  species INTEGER NOT NULL,
  uncertain INTEGER NOT NULL,
  not_understood INTEGER NOT NULL,
  corrections INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  reviewed INTEGER NOT NULL,
  offline INTEGER NOT NULL,
  trektel INTEGER NOT NULL,
  tuintelling INTEGER NOT NULL,
  exported TEXT NOT NULL
)`;

const ready = new WeakMap<D1Database, Promise<unknown>>();
function ensureTable(db: D1Database): Promise<unknown> {
  let promise = ready.get(db);
  if (!promise) {
    promise = db.prepare(SCHEMA).run();
    promise.catch(() => ready.delete(db));
    ready.set(db, promise);
  }
  return promise;
}

/** Een samenvatting zoals de eigenaar hem ophaalt, met de twee weken erbij */
export type StoredSummary = SessionSummary & { week: string; cohort: string };

const COUNTS = [
  'utterances',
  'observations',
  'species',
  'uncertain',
  'notUnderstood',
  'corrections',
  'failed',
  'reviewed',
] as const;
const FLAGS = ['offline', 'trektel', 'tuintelling'] as const;
const EXPORTED = ['none', 'waarneming', 'ebird', 'both'];
const PLATFORMS = ['android', 'web'];

const count = (value: unknown, max: number) =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

/** Precies de velden van `SessionSummary`, met redelijke grenzen; anders `null`. */
export function checkSummary(body: unknown): SessionSummary | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const allowed = new Set<string>(['minutes', ...COUNTS, ...FLAGS, 'exported', 'platform']);
  if (Object.keys(b).some((key) => !allowed.has(key))) return null;
  // Een sessie van meer dan een dag of 10 000 uitspraken is geen echte
  if (!count(b.minutes, 24 * 60)) return null;
  if (COUNTS.some((key) => !count(b[key], 10_000))) return null;
  if (FLAGS.some((key) => typeof b[key] !== 'boolean')) return null;
  if (!EXPORTED.includes(b.exported as string) || !PLATFORMS.includes(b.platform as string)) {
    return null;
  }
  return b as unknown as SessionSummary;
}

export async function storeSummary(
  db: D1Database,
  summary: SessionSummary,
  registeredAt: number | undefined,
  now = new Date(),
): Promise<void> {
  await ensureTable(db);
  const s = summary;
  await db
    .prepare(
      `INSERT INTO session_summaries (week, cohort, platform, minutes, utterances,
         observations, species, uncertain, not_understood, corrections, failed, reviewed,
         offline, trektel, tuintelling, exported)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      weekOf(dayOf(now)),
      registeredAt ? weekOf(dayOf(new Date(registeredAt))) : '',
      s.platform,
      s.minutes,
      s.utterances,
      s.observations,
      s.species,
      s.uncertain,
      s.notUnderstood,
      s.corrections,
      s.failed,
      s.reviewed,
      s.offline ? 1 : 0,
      s.trektel ? 1 : 0,
      s.tuintelling ? 1 : 0,
      s.exported,
    )
    .run();
}

/** Alles vanaf de week van `from`, voor de eigenaar (scherm Statistieken). */
export async function summariesSince(db: D1Database, from: string): Promise<StoredSummary[]> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT week, cohort, platform, minutes, utterances, observations, species, uncertain,
         not_understood AS notUnderstood, corrections, failed, reviewed, offline, trektel,
         tuintelling, exported
       FROM session_summaries WHERE week >= ? ORDER BY week`,
    )
    .bind(weekOf(from))
    .all<Record<string, unknown>>();
  return results.map((row) => ({
    ...(row as unknown as StoredSummary),
    offline: !!row.offline,
    trektel: !!row.trektel,
    tuintelling: !!row.tuintelling,
  }));
}
