import { nameFromWalk } from './area';
import { db, type Session } from './db';
import { logEvent } from './log';

/** De lopende wandeling, als die er is. */
export function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

/** Start een wandeling, of geeft de lopende terug als die er al is. */
export async function startSession(): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await getActiveSession();
    if (active) return active;

    const session: Session = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      status: 'active',
    };
    await db.sessions.add(session);
    return session;
  });
}

/** Stopt een wandeling. `endedAt` alleen anders dan nu als hij vergeten is. */
export async function stopSession(id: string, endedAt = Date.now()): Promise<void> {
  await db.sessions.update(id, { status: 'ended', endedAt });
  await nameFromWalk(id);
}

/** Antwoord "ja, loopt nog" op de vraag hieronder: telt als voortzetten. */
export async function keepSession(id: string): Promise<void> {
  await db.sessions.update(id, { resumedAt: Date.now() });
}

/** Zo lang niets ingesproken: bij het openen van de app vragen of de wandeling nog loopt. */
export const ASK_AFTER_MS = 60 * 60_000;
/** Zo lang niets ingesproken: de wandeling is vergeten en stopt vanzelf. */
export const AUTO_STOP_AFTER_MS = 8 * 60 * 60_000;

/**
 * Laatste teken van leven van een wandeling: de laatste uitspraak, of anders
 * de start of het voortzetten.
 */
export async function lastActivityAt(session: Session): Promise<number> {
  // Van nieuw naar oud: de uitspraken van de lopende wandeling zijn de
  // nieuwste, dus dit stopt meteen (en leest geen oude audio)
  const last = await db.utterances
    .orderBy('recordedAt')
    .reverse()
    .filter((u) => u.sessionId === session.id)
    .first();
  return Math.max(session.startedAt, session.resumedAt ?? 0, last?.recordedAt ?? 0);
}

export type StaleCheck =
  { kind: 'stopped'; session: Session } | { kind: 'ask'; session: Session; lastActivityAt: number };

/**
 * Vergeten wandeling (telefoon uitgevallen, niet op Stop gedrukt)? Na 8 uur
 * zonder uitspraken stopt hij vanzelf, met als eindtijd de laatste uitspraak.
 * Na een uur vraagt de app het. Anders deelt de app hem nooit (alleen
 * gestopte wandelingen gaan naar de ontwikkelaar) en loopt de klok door.
 */
export async function checkStaleSession(now = Date.now()): Promise<StaleCheck | undefined> {
  const session = await getActiveSession();
  if (!session) return;
  const last = await lastActivityAt(session);
  if (now - last >= AUTO_STOP_AFTER_MS) {
    await stopSession(session.id, last);
    logEvent('session_auto_stopped', { lastActivityAt: last }, { sessionId: session.id });
    return { kind: 'stopped', session };
  }
  if (now - last >= ASK_AFTER_MS) return { kind: 'ask', session, lastActivityAt: last };
}

/**
 * Zet een (per ongeluk) gestopte wandeling voort. Doet niets als er al een
 * andere wandeling loopt.
 */
export async function resumeSession(id: string): Promise<boolean> {
  return db.transaction('rw', db.sessions, async () => {
    if (await getActiveSession()) return false;
    await db.sessions.update(id, { status: 'active', endedAt: undefined, resumedAt: Date.now() });
    return true;
  });
}

/**
 * Verwijdert wandelingen voorgoed, met hun uitspraken (en audio), waarnemingen
 * en prullenbak. Het gebeurtenissenlog blijft staan. Een lopende wandeling
 * wordt overgeslagen.
 */
export async function deleteSessions(ids: string[]): Promise<void> {
  const tables = [db.sessions, db.utterances, db.observations, db.deletedObservations];
  const deleted = await db.transaction('rw', tables, async () => {
    const ended = (await db.sessions.bulkGet(ids))
      .filter((s) => s?.status === 'ended')
      .map((s) => s!.id);
    await db.utterances.where('sessionId').anyOf(ended).delete();
    await db.observations.where('sessionId').anyOf(ended).delete();
    await db.deletedObservations.where('sessionId').anyOf(ended).delete();
    await db.sessions.bulkDelete(ended);
    return ended;
  });
  // Buiten de transactie: het log staat in een andere tabel
  logEvent('sessions_deleted', { ids: deleted });
}

/** Alle wandelingen, nieuwste eerst. */
export function listSessions(): Promise<Session[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

/**
 * Vraag de browser om onze opslag niet op te ruimen bij ruimtegebrek.
 * Chrome kent dit toe aan geïnstalleerde PWA's; anders weigert het stil.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export interface SessionCounts {
  utterances: number;
  observations: number;
  devNotes: number;
  /**
   * Uitspraken die (nog) niet verwerkt zijn: mislukt (bv. geen bereik) of nog
   * in de wachtrij. Daar kan nog een waarneming in zitten, dus de wandeling
   * is niet leeg.
   */
  unprocessed: number;
}

/** Aantal uitspraken, waarnemingen en dev notes per wandeling, voor het overzicht */
export async function countPerSession(): Promise<Map<string, SessionCounts>> {
  const counts = new Map<string, SessionCounts>();
  const get = (id: string) => {
    if (!counts.has(id))
      counts.set(id, { utterances: 0, observations: 0, devNotes: 0, unprocessed: 0 });
    return counts.get(id)!;
  };
  // Alleen de index lezen, niet de uitspraken zelf (die bevatten de audio)
  for (const id of await db.utterances.orderBy('sessionId').keys()) get(id as string).utterances++;
  for (const id of await db.observations.orderBy('sessionId').keys())
    get(id as string).observations++;
  // `kind` heeft geen index; de audio wordt pas gelezen als iemand hem afspeelt
  await db.utterances.filter((u) => u.kind === 'dev_note').each((u) => get(u.sessionId).devNotes++);
  // Via de index op status; normaal zijn dit er geen of een paar
  await db.utterances
    .where('status')
    .anyOf('failed', 'pending', 'processing')
    .each((u) => get(u.sessionId).unprocessed++);
  return counts;
}

/** "1 u 5 min" of "12 min" */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} u ${m} min` : `${m} min`;
}
