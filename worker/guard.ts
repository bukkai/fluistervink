// Bescherming van het tegoed tegen misbruik met veel installaties tegelijk
// (ronde vóór productie, 25 nov). De plafonds per installatie (index.ts,
// src/lib/limits.ts) houden één installatie tegen; dit alle samen:
//
// - een noodrem die de eigenaar op Developer aanzet: alles wat geld kost of
//   opslag vult, stopt voor iedereen behalve de eigenaar;
// - een plafond voor de kosten per dag van alle installaties samen;
// - een grens op nieuwe installaties per uur en per dag;
// - een grens op wat er per dag gedeeld wordt, per installatie en samen.
//
// Daarboven geeft de proxy 503 met een eigen `code`. De app behandelt 503 als
// tijdelijk: uitspraken wachten en gaan later alsnog (queue.ts), delen probeert
// het later opnieuw (share.ts). Er gaat dus niets verloren. Bij een grens voor
// iedereen krijgt de eigenaar een waarschuwing (alert.ts).

import { dayOf, rowCost, type UsageRow } from '../src/lib/costs';
import {
  DAILY_BUDGET_USD,
  NEW_INSTALLS_PER_DAY,
  NEW_INSTALLS_PER_HOUR,
  SHARED_BYTES_PER_DAY,
  SHARED_BYTES_PER_INSTALL_PER_DAY,
} from '../src/lib/limits';
import { alert, type AlertEnv } from './alert';
import { json, OWNER } from './common';
import { ensureTable as ensureUsageTables } from './usage';

export interface GuardEnv extends AlertEnv {
  USAGE: D1Database;
  TESTERS: KVNamespace;
  /** Optioneel: ander plafond per dag in dollars dan DAILY_BUDGET_USD */
  DAILY_BUDGET_USD?: string;
}

/** KV-sleutel (in TESTERS) van de noodrem */
const PAUSED_KEY = 'guard/paused';

/** Hoe lang een instantie de noodrem en de kosten van vandaag onthoudt */
const CACHE_MS = 30_000;

const SCHEMA = `CREATE TABLE IF NOT EXISTS guard_counts (
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
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

/**
 * Telt `amount` op bij een teller van vandaag en geeft de nieuwe stand. Eerst
 * tellen, dan kijken: zo zien gelijktijdige verzoeken elkaar wel.
 */
async function bump(db: D1Database, key: string, amount: number, now: Date): Promise<number> {
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `INSERT INTO guard_counts (day, key, n) VALUES (?, ?, ?)
       ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n
       RETURNING n`,
    )
    .bind(dayOf(now), key, amount)
    .all<{ n: number }>();
  return results[0]?.n ?? amount;
}

/**
 * Tellers van vóór gisteren weg: ze staan per installatie (`share:app-…`) en
 * zijn alleen voor de grens van vandaag nodig. Bij elke nieuwe installatie en
 * als de eigenaar Developer opent.
 */
async function prune(db: D1Database, now: Date): Promise<void> {
  await ensureTable(db);
  const yesterday = dayOf(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  await db.prepare('DELETE FROM guard_counts WHERE day < ?').bind(yesterday).run();
}

async function count(db: D1Database, key: string, now: Date): Promise<number> {
  await ensureTable(db);
  const { results } = await db
    .prepare('SELECT n FROM guard_counts WHERE day = ? AND key = ?')
    .bind(dayOf(now), key)
    .all<{ n: number }>();
  return results[0]?.n ?? 0;
}

const pausedCache = new WeakMap<KVNamespace, { value: boolean; at: number }>();

/** Staat de noodrem aan? */
export async function isPaused(kv: KVNamespace): Promise<boolean> {
  const cached = pausedCache.get(kv);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = (await kv.get(PAUSED_KEY)) !== null;
  pausedCache.set(kv, { value, at: Date.now() });
  return value;
}

async function setPaused(kv: KVNamespace, paused: boolean): Promise<void> {
  if (paused) await kv.put(PAUSED_KEY, String(Date.now()));
  else await kv.delete(PAUSED_KEY);
  pausedCache.set(kv, { value: paused, at: Date.now() });
}

const costCache = new WeakMap<D1Database, { value: number; day: string; at: number }>();

/** Kosten van vandaag in dollars, van iedereen behalve de eigenaar, over beide omgevingen. */
export async function costToday(db: D1Database, now = new Date()): Promise<number> {
  const day = dayOf(now);
  const cached = costCache.get(db);
  if (cached && cached.day === day && Date.now() - cached.at < CACHE_MS) return cached.value;
  await ensureUsageTables(db);
  const { results } = await db
    .prepare(
      `SELECT model, SUM(requests) AS requests, SUM(input_tokens) AS inputTokens,
         SUM(output_tokens) AS outputTokens, SUM(cache_write_tokens) AS cacheWriteTokens,
         SUM(cache_read_tokens) AS cacheReadTokens, SUM(audio_seconds) AS audioSeconds
       FROM usage_all WHERE day = ? AND tester != ? GROUP BY model`,
    )
    .bind(day, OWNER)
    .all<Omit<UsageRow, 'day' | 'tester' | 'channel' | 'session'>>();
  const value = results.reduce(
    (sum, row) => sum + (rowCost({ ...row, day, tester: '', channel: '', session: '' }) ?? 0),
    0,
  );
  costCache.set(db, { value, day, at: Date.now() });
  return value;
}

function budget(env: GuardEnv): number {
  const set = Number(env.DAILY_BUDGET_USD);
  return Number.isFinite(set) && set > 0 ? set : DAILY_BUDGET_USD;
}

const paused = () =>
  json(
    {
      error: 'Fluistervink is even gepauzeerd. Je uitspraken blijven bewaard en gaan later door.',
      code: 'paused',
    },
    503,
  );

/** Vanaf dit deel van het budget een eerste waarschuwing (alert.ts) */
const BUDGET_WARN_FRACTION = 0.8;

const dollars = (n: number) => `$${n.toFixed(2)}`;

/**
 * Mag dit verzoek aan het model of de spraakherkenning door? Undefined als
 * het mag, anders het antwoord. Kan D1 het niet zeggen, dan mag het: een
 * uitspraak mislukt niet omdat het tellen hapert (net als de plafonds per
 * installatie); de noodrem staat in KV en werkt dan nog wel.
 */
export async function guardAi(
  env: GuardEnv,
  tester: string,
  now = new Date(),
): Promise<Response | undefined> {
  if (tester === OWNER) return undefined;
  if (await isPaused(env.TESTERS)) return paused();
  try {
    const spent = await costToday(env.USAGE, now);
    const limit = budget(env);
    if (spent >= limit * BUDGET_WARN_FRACTION && spent < limit) {
      await alert(
        env,
        'budget_bijna',
        `${dollars(spent)} van het dagbudget van ${dollars(limit)} is op. Daarboven wachten de uitspraken van iedereen tot morgen; hoger zetten met DAILY_BUDGET_USD.`,
        now,
      );
    }
    if (spent >= limit) {
      await alert(
        env,
        'budget',
        `Dagbudget bereikt (${dollars(spent)} van ${dollars(limit)}). Uitspraken van iedereen behalve de eigenaar wachten tot morgen; hoger zetten met DAILY_BUDGET_USD.`,
        now,
      );
      return json(
        {
          error:
            'Vandaag is er al heel veel verwerkt. Je uitspraken blijven bewaard en gaan later door.',
          code: 'budget',
        },
        503,
      );
    }
  } catch (error) {
    console.error('Kosten van vandaag niet na te gaan', error);
  }
  return undefined;
}

/**
 * Mag er een nieuwe installatie bij? Telt hem meteen mee. Bij een fout in D1
 * wel: anders kan niemand de app meer openen als het tellen hapert.
 */
export async function guardNewInstall(
  env: GuardEnv,
  now = new Date(),
): Promise<Response | undefined> {
  if (await isPaused(env.TESTERS)) return paused();
  try {
    const hour = `install:${now.toISOString().slice(11, 13)}`;
    const [today, thisHour] = await Promise.all([
      bump(env.USAGE, 'install', 1, now),
      bump(env.USAGE, hour, 1, now),
    ]);
    await prune(env.USAGE, now);
    if (today > NEW_INSTALLS_PER_DAY || thisHour > NEW_INSTALLS_PER_HOUR) {
      await alert(
        env,
        'install_limit',
        `Grens voor nieuwe installaties bereikt (${today} vandaag, ${thisHour} dit uur; grens ${NEW_INSTALLS_PER_DAY} per dag, ${NEW_INSTALLS_PER_HOUR} per uur). Nieuwe gebruikers kunnen nu niet aanmelden.`,
        now,
      );
      return json(
        {
          error: 'Er melden zich nu heel veel nieuwe installaties aan; probeer het later opnieuw.',
          code: 'install_limit',
        },
        503,
      );
    }
  } catch (error) {
    console.error('Nieuwe installaties niet na te gaan', error);
  }
  return undefined;
}

/**
 * Mag `bytes` gedeeld worden? Telt het meteen mee. Bij een fout in D1 wel:
 * delen is niet duur, en de grens per minuut blijft.
 */
export async function guardShare(
  env: GuardEnv,
  tester: string,
  bytes: number,
  now = new Date(),
): Promise<Response | undefined> {
  if (tester === OWNER) return undefined;
  if (await isPaused(env.TESTERS)) return paused();
  try {
    const [mine, all] = await Promise.all([
      bump(env.USAGE, `share:${tester}`, bytes, now),
      bump(env.USAGE, 'share', bytes, now),
    ]);
    if (mine > SHARED_BYTES_PER_INSTALL_PER_DAY || all > SHARED_BYTES_PER_DAY) {
      if (all > SHARED_BYTES_PER_DAY) {
        await alert(
          env,
          'share_limit',
          `Grens voor delen van alle installaties samen bereikt (${Math.round(all / 1e6)} MB vandaag). Delen wacht tot morgen.`,
          now,
        );
      } else {
        // Eén installatie: geen bericht, wel in het log
        console.error('Grens bereikt: delen per installatie', { tester, mine });
      }
      return json(
        {
          error: 'Vandaag is er al veel gedeeld; de app probeert het later opnieuw.',
          code: 'share_limit',
        },
        503,
      );
    }
  } catch (error) {
    console.error('Delen niet na te gaan', error);
  }
  return undefined;
}

/**
 * Stand en noodrem voor Developer (alleen de eigenaar).
 *
 * - GET /api/guard                    { paused, costToday, budget, installsToday, … }
 * - PUT /api/guard { paused: bool }   noodrem aan of uit
 */
export async function guard(request: Request, env: GuardEnv, tester: string): Promise<Response> {
  if (tester !== OWNER) return json({ error: 'Alleen voor de eigenaar' }, 403);
  if (request.method === 'PUT') {
    const { paused } = (await request.json().catch(() => ({}))) as { paused?: unknown };
    if (typeof paused !== 'boolean') return json({ error: 'paused ontbreekt' }, 400);
    await setPaused(env.TESTERS, paused);
    console.error(paused ? 'Noodrem aan' : 'Noodrem uit');
  } else if (request.method !== 'GET') {
    return json({ error: 'Niet gevonden' }, 404);
  }
  const now = new Date();
  // Vers, niet uit het geheugen van deze instantie
  costCache.delete(env.USAGE);
  await prune(env.USAGE, now).catch((error) => console.error('Tellers niet opgeruimd', error));
  const [isNowPaused, spent, installsToday, sharedToday] = await Promise.all([
    isPaused(env.TESTERS),
    costToday(env.USAGE, now),
    count(env.USAGE, 'install', now),
    count(env.USAGE, 'share', now),
  ]);
  return json({
    paused: isNowPaused,
    costToday: spent,
    budget: budget(env),
    installsToday,
    installsPerDay: NEW_INSTALLS_PER_DAY,
    sharedBytesToday: sharedToday,
    sharedBytesPerDay: SHARED_BYTES_PER_DAY,
  });
}
