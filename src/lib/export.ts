import { db, type DeletedObservation, type Observation, type Session, type Utterance } from './db';
import { APP_VERSION, logEvent } from './log';

// Ruwe export van alle gegevens, als vangnet tijdens de ontwikkeling, en het
// terugzetten ervan. Audio gaat niet mee (een Blob past niet in JSON); alleen
// de grootte.

export async function exportAllJson(): Promise<Blob> {
  const [sessions, utterances, observations, deletedObservations, events] = await Promise.all([
    db.sessions.toArray(),
    db.utterances.toArray(),
    db.observations.toArray(),
    db.deletedObservations.toArray(),
    db.events.toArray(),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    sessions,
    utterances: utterances.map(({ audio, ...u }) => ({ ...u, audioBytes: audio?.size })),
    observations,
    deletedObservations,
    events,
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/** Laat de browser een bestand downloaden. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  /** Toegevoegde wandelingen */
  added: number;
  /** Wandelingen die er al waren (zelfde id) en zijn overgeslagen */
  skipped: number;
}

/**
 * Leest een JSON-export (van `exportAllJson`) terug in. Alleen wandelingen die
 * er nog niet zijn, met hun uitspraken, waarnemingen en prullenbak; het
 * gebeurtenissenlog niet. Opnames zitten niet in de export, dus terugluisteren
 * kan niet bij geïmporteerde wandelingen.
 */
export async function importJson(file: File): Promise<ImportResult> {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data?.sessions) || !Array.isArray(data?.utterances)) {
    throw new Error('Dit is geen export van Fluistervink.');
  }
  const sessions: Session[] = data.sessions;
  const utterances: (Utterance & { audioBytes?: number })[] = data.utterances;
  const observations: Observation[] = data.observations ?? [];
  const deleted: DeletedObservation[] = data.deletedObservations ?? [];

  const tables = [db.sessions, db.utterances, db.observations, db.deletedObservations];
  const result = await db.transaction('rw', tables, async () => {
    const existing = new Set(await db.sessions.toCollection().primaryKeys());
    const fresh = sessions.filter((s) => !existing.has(s.id));
    const ids = new Set(fresh.map((s) => s.id));
    const lastObservation = (id: string) =>
      Math.max(0, ...observations.filter((o) => o.sessionId === id).map((o) => o.observedAt));

    await db.sessions.bulkAdd(
      fresh.map((s) => ({
        ...s,
        // Een wandeling die bij het exporteren nog liep, komt binnen als gestopt
        status: 'ended' as const,
        endedAt: s.endedAt ?? (lastObservation(s.id) || s.startedAt),
      })),
    );
    await db.utterances.bulkAdd(
      utterances
        .filter((u) => ids.has(u.sessionId))
        .map(({ audioBytes: _, ...u }) =>
          // Zonder opname valt er niets meer te verwerken; niet in de wachtrij zetten
          u.status === 'pending' || u.status === 'processing'
            ? { ...u, status: 'failed' as const, error: 'Geïmporteerd zonder opname' }
            : u,
        ),
    );
    await db.observations.bulkAdd(observations.filter((o) => ids.has(o.sessionId)));
    await db.deletedObservations.bulkAdd(deleted.filter((o) => ids.has(o.sessionId)));
    return { added: fresh.length, skipped: sessions.length - fresh.length, ids: [...ids] };
  });
  // Buiten de transactie: het log staat in een andere tabel
  logEvent('imported', { file: file.name, sessionIds: result.ids, skipped: result.skipped });
  return { added: result.added, skipped: result.skipped };
}
