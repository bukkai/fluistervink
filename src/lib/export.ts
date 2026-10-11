import { db, type DeletedObservation, type Observation, type Session, type Utterance } from './db';
import { APP_VERSION, logEvent } from './log';

// Ruwe export van alle gegevens, als vangnet tijdens de ontwikkeling, en het
// terugzetten ervan. Standaard zonder audio, alleen de grootte; met
// `withAudio` gaat elke opname mee als data-URL (`audioData`), voor de testset
// (zie scripts/testset.mjs). Dat maakt het bestand een stuk groter.

/** Opname als data-URL ("data:audio/webm;codecs=opus;base64,…"), met het formaat erin */
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Terug naar een opname, met precies het formaat van de data-URL */
function fromDataUrl(url: string): Blob {
  const [head, data] = url.split(',');
  const type = head.replace(/^data:/, '').replace(/;base64$/, '');
  return new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type });
}

export async function exportAllJson({ withAudio = false } = {}): Promise<Blob> {
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
    utterances: await Promise.all(
      utterances.map(async ({ audio, ...u }) => ({
        ...u,
        audioBytes: audio?.size,
        audioData: withAudio && audio ? await toDataUrl(audio) : undefined,
      })),
    ),
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
 * gebeurtenissenlog niet. Opnames alleen als de export ze bevat.
 */
export async function importJson(file: File): Promise<ImportResult> {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data?.sessions) || !Array.isArray(data?.utterances)) {
    throw new Error('Dit is geen export van Fluistervink.');
  }
  const sessions: Session[] = data.sessions;
  type ExportedUtterance = Omit<Utterance, 'audio'> & { audioBytes?: number; audioData?: string };
  const exported: ExportedUtterance[] = data.utterances;
  const utterances: Utterance[] = exported.map(({ audioBytes: _, audioData, ...u }) => ({
    ...u,
    audio: audioData ? fromDataUrl(audioData) : undefined,
  }));
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
        .map((u) =>
          // Niet in de wachtrij zetten; met een opname kan "Opnieuw" nog
          u.status === 'pending' || u.status === 'processing'
            ? {
                ...u,
                status: 'failed' as const,
                error: u.audio ? 'Geïmporteerd voordat hij verwerkt was' : 'Geïmporteerd zonder opname',
              }
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
