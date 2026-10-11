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

export async function stopSession(id: string): Promise<void> {
  await db.sessions.update(id, { status: 'ended', endedAt: Date.now() });
  await nameFromWalk(id);
}

/**
 * Zet een (per ongeluk) gestopte wandeling voort. Doet niets als er al een
 * andere wandeling loopt.
 */
export async function resumeSession(id: string): Promise<boolean> {
  return db.transaction('rw', db.sessions, async () => {
    if (await getActiveSession()) return false;
    await db.sessions.update(id, { status: 'active', endedAt: undefined });
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
}

/** Aantal uitspraken, waarnemingen en dev notes per wandeling, voor het overzicht */
export async function countPerSession(): Promise<Map<string, SessionCounts>> {
  const counts = new Map<string, SessionCounts>();
  const get = (id: string) => {
    if (!counts.has(id)) counts.set(id, { utterances: 0, observations: 0, devNotes: 0 });
    return counts.get(id)!;
  };
  // Alleen de index lezen, niet de uitspraken zelf (die bevatten de audio)
  for (const id of await db.utterances.orderBy('sessionId').keys()) get(id as string).utterances++;
  for (const id of await db.observations.orderBy('sessionId').keys()) get(id as string).observations++;
  // `kind` heeft geen index; de audio wordt pas gelezen als iemand hem afspeelt
  await db.utterances
    .filter((u) => u.kind === 'dev_note')
    .each((u) => get(u.sessionId).devNotes++);
  return counts;
}

/** "1 u 5 min" of "12 min" */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} u ${m} min` : `${m} min`;
}
