import {
  audioBlob,
  audioSize,
  db,
  type DeletedObservation,
  type Checklist,
  type Effort,
  type Observation,
  type Position,
  type Session,
  type SpokenPlace,
  type StoredAudio,
  type Utterance,
} from './db';
import { getTester, type Area } from './api';
import { APP_VERSION, CHANNEL, logEvent } from './log';
import { DIRECTIONS } from './spokenPlace';
import { PLATFORM, isNativeApp, saveFileNative, type SaveResult } from './native';

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
function fromDataUrl(url: string): StoredAudio {
  const [head, data] = url.split(',');
  const type = head.replace(/^data:/, '').replace(/;base64$/, '');
  return { data: Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer, type };
}

/**
 * `withAudio`: alle opnames, geen, of alleen die waarvoor de functie true geeft
 * (de back-up neemt alleen opnames mee die nog nodig zijn, zie backup.ts).
 */
export async function exportAllJson({
  withAudio = false,
}: { withAudio?: boolean | ((u: Utterance) => boolean) } = {}): Promise<Blob> {
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
    channel: CHANNEL,
    platform: PLATFORM,
    tester: getTester(),
    sessions,
    utterances: await Promise.all(
      utterances.map(async (utterance) => {
        const { audio, ...u } = utterance;
        const include = typeof withAudio === 'function' ? withAudio(utterance) : withAudio;
        return {
          ...u,
          audioBytes: audio && audioSize(audio),
          audioData: include && audio ? await toDataUrl(audioBlob(audio)) : undefined,
        };
      }),
    ),
    observations,
    deletedObservations,
    events,
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/**
 * Slaat een bestand op: in de browser als download, in de Android-app in
 * Downloads (daar doet een download niets). Geeft false als de gebruiker
 * annuleert. In de browser weten we niet of de download lukt; daar altijd
 * opgeslagen, zonder map.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (isNativeApp) return saveFileNative(blob, filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return {};
}

export interface ImportResult {
  /** Toegevoegde sessies */
  added: number;
  /** Sessies die er al waren (zelfde id) en zijn overgeslagen */
  skipped: number;
  /** Toegevoegde losse feedback (buiten een sessie) */
  feedback: number;
}

/**
 * Leest een JSON-export (van `exportAllJson`) terug in. Alleen sessies die
 * er nog niet zijn, met hun uitspraken, waarnemingen en prullenbak, plus losse
 * feedback die er nog niet is; het gebeurtenissenlog niet. Opnames alleen als
 * de export ze bevat. Er wordt niets overschreven.
 */
export async function importJson(file: File): Promise<ImportResult> {
  const data = JSON.parse(await file.text());
  checkImport(data);
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
        // Een sessie die bij het exporteren nog liep, komt binnen als gestopt
        status: 'ended' as const,
        endedAt: s.endedAt ?? (lastObservation(s.id) || s.startedAt),
      })),
    );
    // Losse feedback hoort bij geen sessie: per uitspraak nagaan
    const loose = utterances.filter((u) => u.sessionId === '');
    const present = new Set(
      await db.utterances
        .where('id')
        .anyOf(loose.map((u) => u.id))
        .primaryKeys(),
    );
    const freshLoose = new Set(loose.filter((u) => !present.has(u.id)));
    await db.utterances.bulkAdd(
      utterances
        .filter((u) => ids.has(u.sessionId) || freshLoose.has(u))
        .map((u) =>
          // Niet in de wachtrij zetten; met een opname kan "Opnieuw" nog
          u.status === 'pending' || u.status === 'processing'
            ? {
                ...u,
                status: 'failed' as const,
                error: u.audio
                  ? 'Geïmporteerd voordat hij verwerkt was'
                  : 'Geïmporteerd zonder opname',
              }
            : u,
        ),
    );
    await db.observations.bulkAdd(observations.filter((o) => ids.has(o.sessionId)));
    await db.deletedObservations.bulkAdd(deleted.filter((o) => ids.has(o.sessionId)));
    return {
      added: fresh.length,
      skipped: sessions.length - fresh.length,
      feedback: freshLoose.size,
      ids: [...ids],
    };
  });
  // Buiten de transactie: het log staat in een andere tabel
  const { ids, ...counts } = result;
  logEvent('imported', { file: file.name, sessionIds: ids, ...counts });
  return counts;
}

/** Uitkomst van een import in een zin, voor op het scherm */
export function describeImport({ added, skipped, feedback }: ImportResult): string {
  return [
    added === 0
      ? 'Geen nieuwe sessies gevonden.'
      : `${added === 1 ? '1 sessie' : `${added} sessies`} teruggezet, te vinden bij Vorige sessies.`,
    skipped > 0 && `${skipped} stond${skipped === 1 ? '' : 'en'} er al.`,
    feedback > 0 && `${feedback}× losse feedback teruggezet.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Controleert de typen van wat er geïmporteerd wordt. Een export kan van een
 * tester komen (npm run feedback -- pull) en is dus niet te vertrouwen; zo
 * komt er geen tekst binnen waar de app een getal verwacht.
 */
function checkImport(data: {
  sessions?: unknown;
  utterances?: unknown;
  observations?: unknown;
  deletedObservations?: unknown;
}): void {
  if (!Array.isArray(data?.sessions) || !Array.isArray(data?.utterances)) {
    throw new Error('Dit is geen export van Fluistervink.');
  }
  const fail = (what: string): never => {
    throw new Error(`Ongeldige export: ${what}`);
  };
  const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  const isId = (value: unknown) => typeof value === 'string' && value.length > 0;
  const optional = (value: unknown, check: (value: unknown) => boolean) =>
    value === undefined || value === null || check(value);
  const isPosition = (value: unknown) => {
    const p = value as Position;
    return (
      isNumber(p?.lat) && isNumber(p?.lon) && isNumber(p?.accuracy) && optional(p.fixedAt, isNumber)
    );
  };
  const isSpokenPlace = (value: unknown) => {
    const p = value as SpokenPlace;
    return (
      typeof p?.text === 'string' &&
      optional(p.distanceM, isNumber) &&
      optional(p.direction, (d) => typeof d === 'string' && Object.hasOwn(DIRECTIONS, d))
    );
  };
  const isEffort = (value: unknown) => {
    const e = value as Effort;
    return (
      isNumber(e?.activeMs) &&
      isNumber(e.distanceM) &&
      optional(e.activeSince, isNumber) &&
      optional(e.anchor, isPosition)
    );
  };
  // Gaat letterlijk in het bestand voor eBird: alleen bekende waarden
  const isChecklist = (value: unknown) => {
    const c = value as Checklist;
    return (
      typeof c === 'object' &&
      c !== null &&
      optional(c.observers, (n) => Number.isInteger(n) && (n as number) >= 1) &&
      optional(c.complete, (b) => typeof b === 'boolean') &&
      optional(c.protocol, (p) => p === 'Stationary' || p === 'Traveling' || p === 'Incidental') &&
      optional(c.distanceM, isNumber) &&
      optional(c.skipEbird, (b) => typeof b === 'boolean')
    );
  };
  const isArea = (value: unknown) => {
    const a = value as Area;
    return isNumber(a?.id) && typeof a?.name === 'string';
  };

  for (const s of data.sessions as Session[]) {
    if (
      !isId(s?.id) ||
      !isNumber(s.startedAt) ||
      !optional(s.endedAt, isNumber) ||
      !optional(s.effort, isEffort) ||
      !optional(s.checklist, isChecklist) ||
      !optional(s.ebirdExportedAt, isNumber)
    )
      fail('sessie');
  }
  for (const u of data.utterances as (Utterance & { audioData?: unknown })[]) {
    const ok =
      isId(u?.id) &&
      // Leeg bij losse feedback (buiten een sessie)
      typeof u.sessionId === 'string' &&
      isNumber(u.recordedAt) &&
      optional(u.position, isPosition) &&
      optional(u.area, isArea) &&
      optional(u.audioData, (a) => typeof a === 'string' && a.startsWith('data:audio/'));
    if (!ok) fail('uitspraak');
  }
  for (const key of ['observations', 'deletedObservations'] as const) {
    const list = data[key] ?? [];
    if (!Array.isArray(list)) fail('waarnemingen');
    for (const o of list as Observation[]) {
      const ok =
        isId(o?.id) &&
        isId(o.sessionId) &&
        isId(o.utteranceId) &&
        isNumber(o.speciesId) &&
        isNumber(o.count) &&
        isNumber(o.observedAt) &&
        typeof o.uncertain === 'boolean' &&
        optional(o.position, isPosition) &&
        optional(o.recordedPosition, isPosition) &&
        optional(o.spokenPlace, isSpokenPlace) &&
        optional(o.candidates, (c) => Array.isArray(c) && c.every(isNumber)) &&
        optional(o.area, isArea);
      if (!ok) fail('waarneming');
    }
  }
}
