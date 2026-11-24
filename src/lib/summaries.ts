// Anonieme cijfers per sessie (stap 3 van "Statistieken en Developer
// uitbreiden", docs/proxy.md): een handvol getallen over hoe een sessie ging,
// zonder installatie, plek, soorten, tijdstip of tekst. Zo ziet de eigenaar
// hoe goed de herkenning werkt en of mensen nalopen en exporteren, ook bij wie
// niets deelt. Standaard aan, uit te zetten bij Instellingen.
//
// Een sessie gaat pas als hij geëxporteerd is, of een week na het stoppen:
// dan zegt de samenvatting ook of er nagelopen en geëxporteerd is. Gaat het
// mis (geen bereik), dan bij de volgende gelegenheid opnieuw. Alleen sessies
// die stopten nadat deze functie op de telefoon kwam, niet de hele geschiedenis.

import { ApiError, sendSummary } from './api';
import { db } from './db';
import { isAndroidApp, isIosApp } from './native';
import type { SessionSummary } from './stats';

const ENABLED_KEY = 'fluistervink.anonStats';
const SENT_KEY = 'fluistervink.anonStatsSent';
const SINCE_KEY = 'fluistervink.anonStatsSince';
/** Zo lang na het stoppen gaat een sessie die niet geëxporteerd is alsnog */
export const WAIT_MS = 7 * 24 * 60 * 60_000;

// Het type staat in stats.ts: de proxy gebruikt het ook, en dit bestand haalt
// browsercode binnen (database, installatie) die de proxy niet kent.
export type { SessionSummary } from './stats';

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Vol of geblokkeerd: dan volgende keer opnieuw
  }
}

export function anonStatsEnabled(): boolean {
  return read(ENABLED_KEY, true);
}

export function setAnonStatsEnabled(on: boolean): void {
  write(ENABLED_KEY, on);
  if (on) scheduleSummaries();
}

/** Vanaf wanneer sessies meetellen: het eerste moment dat deze functie liep */
function since(): number {
  const stored = read<number | undefined>(SINCE_KEY, undefined);
  if (stored) return stored;
  const now = Date.now();
  write(SINCE_KEY, now);
  return now;
}

/** De cijfers van één gestopte sessie, of `undefined` als die er niet (meer) is. */
export async function summarize(sessionId: string): Promise<SessionSummary | undefined> {
  const session = await db.sessions.get(sessionId);
  if (!session || session.status !== 'ended' || !session.endedAt) return undefined;
  const [utterances, observations, waited] = await Promise.all([
    db.utterances.where('sessionId').equals(sessionId).toArray(),
    db.observations.where('sessionId').equals(sessionId).toArray(),
    db.events
      .where('type')
      .equals('queue_resumed')
      .filter((e) => e.sessionId === sessionId)
      .count(),
  ]);
  // Feedback over de app is geen uitspraak over vogels
  const spoken = utterances.filter((u) => u.kind !== 'dev_note' && u.result !== 'note');
  const exported = session.exportedAt
    ? session.ebirdExportedAt
      ? 'both'
      : 'waarneming'
    : session.ebirdExportedAt
      ? 'ebird'
      : 'none';
  return {
    minutes: Math.round((session.endedAt - session.startedAt) / 60_000 / 5) * 5,
    utterances: spoken.length,
    observations: observations.length,
    species: new Set(observations.map((o) => o.speciesId)).size,
    uncertain: observations.filter((o) => o.uncertain).length,
    notUnderstood: spoken.filter((u) => u.result === 'ignored').length,
    corrections: spoken.filter(
      (u) => u.undid || u.changes?.some((c) => c.type === 'update' || c.type === 'delete'),
    ).length,
    failed: spoken.filter((u) => u.status === 'failed').length,
    reviewed: observations.filter((o) => o.status !== 'draft').length,
    offline: waited > 0,
    trektel: spoken.some((u) => u.trektel),
    tuintelling: !!session.tuintelling,
    exported,
    platform: isAndroidApp ? 'android' : isIosApp ? 'ios' : 'web',
  };
}

/** Sessies die klaar zijn om te gaan: geëxporteerd, of een week gestopt. */
export async function dueSessions(now = Date.now()): Promise<string[]> {
  const from = since();
  const sent = new Set(read<string[]>(SENT_KEY, []));
  const ended = await db.sessions.where('status').equals('ended').toArray();
  return ended
    .filter(
      (s) =>
        !sent.has(s.id) &&
        !!s.endedAt &&
        s.endedAt >= from &&
        (!!s.exportedAt || !!s.ebirdExportedAt || now - s.endedAt >= WAIT_MS),
    )
    .map((s) => s.id);
}

let running: Promise<number> | undefined;

/** Verstuurt wat klaar is; geeft het aantal verstuurde sessies. Eén ronde tegelijk. */
export function sendSummaries(now = Date.now()): Promise<number> {
  running ??= run(now).finally(() => (running = undefined));
  return running;
}

async function run(now: number): Promise<number> {
  if (!anonStatsEnabled() || !navigator.onLine) return 0;
  // Verstuurde sessies blijven in de lijst zolang ze bestaan: een geëxporteerde
  // sessie komt altijd weer in aanmerking, dus inkorten tot de laatste zoveel
  // zou de oudste steeds opnieuw sturen. Verwijderde sessies kunnen eruit.
  const existing = new Set(await db.sessions.toCollection().primaryKeys());
  let sent = read<string[]>(SENT_KEY, []).filter((id) => existing.has(id));
  write(SENT_KEY, sent);
  let count = 0;
  for (const id of await dueSessions(now)) {
    const summary = await summarize(id);
    try {
      if (summary) await sendSummary(summary);
    } catch (error) {
      // De proxy weigert hem echt (400): overslaan, anders houdt hij de rest tegen.
      // Anders (geen bereik, server even weg): volgende keer verder.
      if (!(error instanceof ApiError && error.status === 400)) break;
    }
    sent = [...sent, id];
    write(SENT_KEY, sent);
    count++;
  }
  return count;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Even wachten, zodat het opstarten of stoppen er niet op hoeft te wachten. */
export function scheduleSummaries(delayMs = 5000): void {
  clearTimeout(timer);
  timer = setTimeout(() => sendSummaries().catch(() => {}), delayMs);
}
