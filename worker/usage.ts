// Verbruik van OpenAI en Anthropic, door de proxy zelf geteld: per dag,
// tester, omgeving, sessie en model de tokens (of seconden audio bij
// whisper-1) en het aantal verzoeken. Geen inhoud, alleen getallen. De app
// rekent het met een prijstabel om naar dollars (src/lib/costs.ts), zodat een
// prijswijziging geen oude cijfers raakt.
//
// In D1 (binding USAGE), omdat elk verzoek optelt: KV kan dat niet veilig bij
// gelijktijdige verzoeken (de testset stuurt er veel tegelijk), en heeft in het
// gratis plan maar ~1000 schrijfacties per dag.

import { dayOf, type UsageRow } from '../src/lib/costs';
import type { ActivityRow } from '../src/lib/stats';

/** Wat één verzoek verbruikte. */
export type Usage = Pick<
  UsageRow,
  'inputTokens' | 'outputTokens' | 'cacheWriteTokens' | 'cacheReadTokens' | 'audioSeconds'
>;

/** De tabel van vóór 23 nov; de stabiele versie schrijft hier nog in tot zijn release. */
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
 * Sinds 23 nov telt de proxy ook per soort uitspraak (`kind`: knop, trektel,
 * tuintelling, proberen), versie van de app en taal; leeg als de app het niet
 * meestuurde (oudere versies, de testset). Alleen labels, geen inhoud.
 *
 * In een eigen tabel, niet door `usage` om te bouwen: beta en stable delen deze
 * database, en de code van stable schrijft met de oude sleutel. Die zou na een
 * ombouw niet meer passen, en dan telde stable niets meer.
 */
const LABELED_SCHEMA = `CREATE TABLE IF NOT EXISTS usage_labeled (
  day TEXT NOT NULL,
  tester TEXT NOT NULL,
  channel TEXT NOT NULL,
  session TEXT NOT NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  audio_seconds REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tester, channel, session, model, kind, version, language)
)`;

const NUMBERS = `requests, input_tokens, output_tokens, cache_write_tokens,
  cache_read_tokens, audio_seconds`;

/**
 * Alles samen om te lezen: de oude tabel met lege labels, plus de nieuwe. Elk
 * verzoek staat maar in één van de twee, dus optellen klopt.
 */
const VIEW_SCHEMA = `CREATE VIEW IF NOT EXISTS usage_all AS
  SELECT day, tester, channel, session, model, '' AS kind, '' AS version, '' AS language,
    ${NUMBERS} FROM usage
  UNION ALL
  SELECT day, tester, channel, session, model, kind, version, language,
    ${NUMBERS} FROM usage_labeled`;

/**
 * Wat er na de bewaartermijn van een week overblijft: totalen per omgeving en
 * model, zonder installatie of sessie (`pruneUsage`). Genoeg voor de kosten
 * door de jaren heen, niet meer te herleiden tot iemand.
 */
const WEEKLY_SCHEMA = `CREATE TABLE IF NOT EXISTS usage_weekly (
  week TEXT NOT NULL,
  channel TEXT NOT NULL,
  model TEXT NOT NULL,
  testers INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  audio_seconds REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (week, channel, model)
)`;

/**
 * De tabel maakt de Worker zelf aan (één keer per instantie), zodat er bij het
 * deployen geen migratiestap nodig is.
 */
const ready = new WeakMap<D1Database, Promise<unknown>>();

function ensureTable(db: D1Database): Promise<unknown> {
  let promise = ready.get(db);
  if (!promise) {
    promise = db
      .prepare(SCHEMA)
      .run()
      .then(() => db.prepare(LABELED_SCHEMA).run())
      .then(() => db.prepare(VIEW_SCHEMA).run())
      .then(() => db.prepare(WEEKLY_SCHEMA).run());
    // Mislukt het, dan bij het volgende verzoek opnieuw
    promise.catch(() => ready.delete(db));
    ready.set(db, promise);
  }
  return promise;
}

/**
 * Per tester de laatste dag met een uitspraak in een sessie ("2026-11-03"),
 * ook van wie delen uit heeft staan. Voor de lijst met installaties.
 */
export async function lastUsedPerTester(db: D1Database): Promise<Map<string, string>> {
  await ensureTable(db);
  const { results } = await db
    .prepare(`SELECT tester, MAX(day) AS day FROM usage_all WHERE session != '' GROUP BY tester`)
    .all<{ tester: string; day: string }>();
  return new Map(results.map((row) => [row.tester, row.day]));
}

/** Een id van de app (`crypto.randomUUID()`); al het andere telt als "geen sessie". */
const SESSION_ID = /^[\w-]{1,64}$/;

export function sessionFrom(request: Request): string {
  const session = request.headers.get('X-Session') ?? '';
  return SESSION_ID.test(session) ? session : '';
}

const KINDS = ['knop', 'trektel', 'tuintelling', 'proberen'];
/** Versie van de app: een korte commit, eventueel met "+" (`appVersion` in vite.config.ts) */
const VERSION = /^[\w.+-]{1,32}$/;

/**
 * Soort uitspraak, versie en taal uit de headers van de app (`usageHeaders` in
 * src/lib/api.ts). Alleen bekende waarden; al het andere telt als leeg, zodat
 * niemand willekeurige tekst in de tabel kan zetten.
 */
export function labelsFrom(request: Request): { kind: string; version: string; language: string } {
  const kind = request.headers.get('X-Kind') ?? '';
  const version = request.headers.get('X-App-Version') ?? '';
  const language = request.headers.get('X-Language') ?? '';
  return {
    kind: KINDS.includes(kind) ? kind : '',
    version: VERSION.test(version) ? version : '',
    language: language === 'nl' || language === 'en' ? language : '',
  };
}

/** Telt één verzoek op bij de regel van vandaag. */
export async function recordUsage(
  db: D1Database,
  key: {
    tester: string;
    channel: string;
    session: string;
    model: string;
    kind?: string;
    version?: string;
    language?: string;
  },
  usage: Partial<Usage>,
  now = new Date(),
): Promise<void> {
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO usage_labeled (day, tester, channel, session, model, kind, version, language,
         requests, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
         audio_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT (day, tester, channel, session, model, kind, version, language) DO UPDATE SET
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
      key.kind ?? '',
      key.version ?? '',
      key.language ?? '',
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
      usage.cacheWriteTokens ?? 0,
      usage.cacheReadTokens ?? 0,
      usage.audioSeconds ?? 0,
    )
    .run();
}

/**
 * Seconden audio die een tester vandaag (Nederlandse tijd) liet verstaan,
 * over beide omgevingen en alle sessies. Voor het plafond per dag in de proxy.
 * Telt alleen modellen die per seconde rekenen; de andere geven tokens.
 */
export async function audioSecondsToday(
  db: D1Database,
  tester: string,
  now = new Date(),
): Promise<number> {
  await ensureTable(db);
  const { results } = await db
    .prepare(`SELECT SUM(audio_seconds) AS seconds FROM usage_all WHERE day = ? AND tester = ?`)
    .bind(dayOf(now), tester)
    .all<{ seconds: number | null }>();
  return results[0]?.seconds ?? 0;
}

/**
 * Aantal verzoeken aan het model (Anthropic) van een tester vandaag, over
 * beide omgevingen. Voor het plafond per dag in de proxy.
 */
export async function messagesToday(
  db: D1Database,
  tester: string,
  now = new Date(),
): Promise<number> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT SUM(requests) AS requests FROM usage_all
       WHERE day = ? AND tester = ? AND model LIKE 'claude-%'`,
    )
    .bind(dayOf(now), tester)
    .all<{ requests: number | null }>();
  return results[0]?.requests ?? 0;
}

/** Alle regels vanaf `from` (een datum als `2026-09-01`), voor de eigenaar. */
export async function usageSince(db: D1Database, from: string): Promise<UsageRow[]> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT day, tester, channel, session, model, kind, version, language, requests,
         input_tokens AS inputTokens, output_tokens AS outputTokens,
         cache_write_tokens AS cacheWriteTokens, cache_read_tokens AS cacheReadTokens,
         audio_seconds AS audioSeconds
       FROM usage_all WHERE day >= ? ORDER BY day, tester, session, model`,
    )
    .bind(from)
    .all<UsageRow>();
  return results;
}

/**
 * Wie op welke dag de app gebruikte (scherm Statistieken, src/lib/stats.ts), samengevat uit de usage-tabel: geen
 * nieuw gegeven, alleen anders geteld. Verzoeken zonder sessie (de testset)
 * tellen niet mee, anders lijkt de eigenaar elke testsetdag actief.
 */
export async function activitySince(db: D1Database, from: string): Promise<ActivityRow[]> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT day, tester, COUNT(DISTINCT session) AS sessions,
         SUM(CASE WHEN model LIKE '%transcribe%' OR model = 'whisper-1'
           THEN requests ELSE 0 END) AS utterances
       FROM usage_all WHERE day >= ? AND session != ''
       GROUP BY day, tester ORDER BY day, tester`,
    )
    .bind(from)
    .all<ActivityRow>();
  return results;
}

/** Hoe lang regels per installatie blijven: 13 maanden, zodat een heel jaar te vergelijken is. */
export const KEEP_MONTHS = 13;

/** De eerste dag die nog per installatie bewaard blijft. */
export function keepFrom(now = new Date()): string {
  const day = dayOf(now);
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - KEEP_MONTHS);
  return date.toISOString().slice(0, 10);
}

/**
 * Regels van vóór de bewaartermijn samenvatten per week (maandag), omgeving en
 * model, zonder installatie en sessie, en daarna wissen. Draait als de
 * eigenaar de kosten ophaalt; is er niets ouds, dan doet het niets.
 */
export async function pruneUsage(db: D1Database, now = new Date()): Promise<number> {
  await ensureTable(db);
  const before = keepFrom(now);
  const { results } = await db
    .prepare(`SELECT COUNT(*) AS old FROM usage_all WHERE day < ?`)
    .bind(before)
    .all<{ old: number }>();
  const old = results[0]?.old ?? 0;
  if (!old) return 0;
  // Samenvatten en wissen in één batch: helemaal of niet, dus nooit dubbel geteld.
  // Maandag van de week: zondag telt als laatste dag (weekday 0 = zondag)
  await db.batch([
    db
      .prepare(
        `INSERT INTO usage_weekly (week, channel, model, testers, requests, input_tokens,
         output_tokens, cache_write_tokens, cache_read_tokens, audio_seconds)
       SELECT date(day, '-6 days', 'weekday 1') AS week, channel, model,
         COUNT(DISTINCT tester), SUM(requests), SUM(input_tokens), SUM(output_tokens),
         SUM(cache_write_tokens), SUM(cache_read_tokens), SUM(audio_seconds)
       FROM usage_all WHERE day < ? GROUP BY week, channel, model
       ON CONFLICT (week, channel, model) DO UPDATE SET
         testers = testers + excluded.testers,
         requests = requests + excluded.requests,
         input_tokens = input_tokens + excluded.input_tokens,
         output_tokens = output_tokens + excluded.output_tokens,
         cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
         cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
         audio_seconds = audio_seconds + excluded.audio_seconds`,
      )
      .bind(before),
    db.prepare(`DELETE FROM usage WHERE day < ?`).bind(before),
    db.prepare(`DELETE FROM usage_labeled WHERE day < ?`).bind(before),
  ]);
  return old;
}
