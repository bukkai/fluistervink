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
