// Verbruik van OpenAI en Anthropic, door de proxy zelf geteld: per dag,
// tester, omgeving, wandeling en model de tokens (of seconden audio bij
// whisper-1) en het aantal verzoeken. Geen inhoud, alleen getallen. De app
// rekent het met een prijstabel om naar dollars (src/lib/costs.ts), zodat een
// prijswijziging geen oude cijfers raakt.
//
// In D1 (binding USAGE), omdat elk verzoek optelt: KV kan dat niet veilig bij
// gelijktijdige verzoeken (de testset stuurt er veel tegelijk), en heeft in het
// gratis plan maar ~1000 schrijfacties per dag.

import { dayOf, type UsageRow } from '../src/lib/costs';

/** Wat één verzoek verbruikte. */
export type Usage = Pick<
  UsageRow,
  'inputTokens' | 'outputTokens' | 'cacheWriteTokens' | 'cacheReadTokens' | 'audioSeconds'
>;

const SCHEMA = `CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  tester TEXT NOT NULL,
  channel TEXT NOT NULL,
  session TEXT NOT NULL,
  model TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  audio_seconds REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tester, channel, session, model)
)`;

/**
 * De tabel maakt de Worker zelf aan (één keer per instantie), zodat er bij het
 * deployen geen migratiestap nodig is.
 */
const ready = new WeakMap<D1Database, Promise<unknown>>();

function ensureTable(db: D1Database): Promise<unknown> {
  let promise = ready.get(db);
  if (!promise) {
    promise = db.prepare(SCHEMA).run();
    // Mislukt het, dan bij het volgende verzoek opnieuw
    promise.catch(() => ready.delete(db));
    ready.set(db, promise);
  }
  return promise;
}

/** Een id van de app (`crypto.randomUUID()`); al het andere telt als "geen wandeling". */
const SESSION_ID = /^[\w-]{1,64}$/;

export function sessionFrom(request: Request): string {
  const session = request.headers.get('X-Session') ?? '';
  return SESSION_ID.test(session) ? session : '';
}

/** Telt één verzoek op bij de regel van vandaag. */
export async function recordUsage(
  db: D1Database,
  key: { tester: string; channel: string; session: string; model: string },
  usage: Partial<Usage>,
  now = new Date(),
): Promise<void> {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO usage (day, tester, channel, session, model, requests, input_tokens,
         output_tokens, cache_write_tokens, cache_read_tokens, audio_seconds)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT (day, tester, channel, session, model) DO UPDATE SET
         requests = requests + 1,
         input_tokens = input_tokens + excluded.input_tokens,
         output_tokens = output_tokens + excluded.output_tokens,
         cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
         cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
         audio_seconds = audio_seconds + excluded.audio_seconds`,
    )
    .bind(
      dayOf(now),
      key.tester,
      key.channel,
      key.session,
      key.model,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
      usage.cacheWriteTokens ?? 0,
      usage.cacheReadTokens ?? 0,
      usage.audioSeconds ?? 0,
    )
    .run();
}

/** Alle regels vanaf `from` (een datum als `2026-09-01`), voor de eigenaar. */
export async function usageSince(db: D1Database, from: string): Promise<UsageRow[]> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT day, tester, channel, session, model, requests,
         input_tokens AS inputTokens, output_tokens AS outputTokens,
         cache_write_tokens AS cacheWriteTokens, cache_read_tokens AS cacheReadTokens,
         audio_seconds AS audioSeconds
       FROM usage WHERE day >= ? ORDER BY day, tester, session, model`,
    )
    .bind(from)
    .all<UsageRow>();
  return results;
}
