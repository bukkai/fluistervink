import { db, type Session } from './db';

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
}

/** Aantal uitspraken en waarnemingen per wandeling, voor het overzicht */
export async function countPerSession(): Promise<Map<string, SessionCounts>> {
  const counts = new Map<string, SessionCounts>();
  const get = (id: string) => {
    if (!counts.has(id)) counts.set(id, { utterances: 0, observations: 0 });
    return counts.get(id)!;
  };
  // Alleen de index lezen, niet de uitspraken zelf (die bevatten de audio)
  for (const id of await db.utterances.orderBy('sessionId').keys()) get(id as string).utterances++;
  for (const id of await db.observations.orderBy('sessionId').keys()) get(id as string).observations++;
  return counts;
}
