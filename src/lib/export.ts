import { t } from './i18n';
import {
  audioBlob,
  audioSize,
  db,
  isDateString,
  isObscurity,
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
import { APP_VERSION, CHANNEL, logEvent, type LogEvent } from './log';
import { DIRECTIONS } from './spokenPlace';
import { PLATFORM, nativeFileSaveSupported, saveFileNative, type SaveResult } from './native';

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
 *
 * Uitspraak voor uitspraak opgebouwd, met de opnames in porties uit de
 * database: een back-up met een seizoen aan opnames werd anders in zijn geheel
 * een paar keer in het geheugen gezet (alle opnames, alle data-URL's en één
 * grote JSON-string), en dat kan een telefoon niet aan (ronde vóór productie,
 * 25 nov). Dezelfde JSON als voorheen, alleen zonder inspringing.
 */
export async function exportAllJson({
  withAudio = false,
}: { withAudio?: boolean | ((u: Utterance) => boolean) } = {}): Promise<Blob> {
  const out = new BlobWriter();
  const header = JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    channel: CHANNEL,
    platform: PLATFORM,
    tester: getTester(),
  });
  // Het object open laten ("{...,"), de lijsten volgen
  out.write(header.slice(0, -1));
  out.write(`,"sessions":${JSON.stringify(await db.sessions.toArray())},"utterances":[`);
  const keys = await db.utterances.toCollection().primaryKeys();
  let first = true;
  for (let i = 0; i < keys.length; i += EXPORT_BATCH) {
    const batch = await db.utterances.bulkGet(keys.slice(i, i + EXPORT_BATCH));
    for (const utterance of batch) {
      if (!utterance) continue;
      const { audio, ...u } = utterance;
      const include = typeof withAudio === 'function' ? withAudio(utterance) : withAudio;
      const exported = {
        ...u,
        audioBytes: audio && audioSize(audio),
        audioData: include && audio ? await toDataUrl(audioBlob(audio)) : undefined,
      };
      out.write((first ? '' : ',') + JSON.stringify(exported));
      first = false;
    }
  }
  const [observations, deletedObservations, events] = await Promise.all([
    db.observations.toArray(),
    db.deletedObservations.toArray(),
    db.events.toArray(),
  ]);
  out.write(
    `],"observations":${JSON.stringify(observations)}` +
      `,"deletedObservations":${JSON.stringify(deletedObservations)}` +
      `,"events":${JSON.stringify(events)}}`,
  );
  return out.blob('application/json');
}

/** Zoveel uitspraken (met hun opname) tegelijk uit de database */
const EXPORT_BATCH = 20;

/**
 * Tekst in delen naar een Blob. Om de paar MB worden de delen samen een Blob,
 * die de browser zo nodig buiten het geheugen bewaart; zo staat nooit het hele
 * bestand als tekst in het geheugen.
 */
class BlobWriter {
  private static readonly FLUSH_CHARS = 4 * 1024 * 1024;
  private blobs: Blob[] = [];
  private strings: string[] = [];
  private chars = 0;

  write(text: string): void {
    this.strings.push(text);
    this.chars += text.length;
    if (this.chars >= BlobWriter.FLUSH_CHARS) this.flush();
  }

  private flush(): void {
    if (!this.strings.length) return;
    this.blobs.push(new Blob(this.strings));
    this.strings = [];
    this.chars = 0;
  }

  blob(type: string): Blob {
    this.flush();
    return new Blob(this.blobs, { type });
  }
}

/**
 * Slaat een bestand op: in de browser als download, in de Android-app in
 * Downloads (daar doet een download niets). Geeft false als de gebruiker
 * annuleert. In de browser weten we niet of de download lukt; daar altijd
 * opgeslagen, zonder map.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveResult> {
  if (nativeFileSaveSupported) return saveFileNative(blob, filename);
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
 * feedback die er nog niet is. Van het gebeurtenissenlog alleen wat binnen de
 * tijd van een toegevoegde sessie valt: anders deelt de app die sessies
 * opnieuw zonder log en overschrijft hij de versie die de ontwikkelaar al had
 * (17 nov). Opnames alleen als de export ze bevat. Er wordt niets overschreven.
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
  const events: LogEvent[] = data.events ?? [];

  const tables = [db.sessions, db.utterances, db.observations, db.deletedObservations, db.events];
  const result = await db.transaction('rw', tables, async () => {
    const existing = new Set(await db.sessions.toCollection().primaryKeys());
    const fresh = sessions.filter((s) => !existing.has(s.id));
    const ids = new Set(fresh.map((s) => s.id));
    const lastObservation = (id: string) =>
      Math.max(0, ...observations.filter((o) => o.sessionId === id).map((o) => o.observedAt));

    const added = fresh.map((s) => ({
      ...s,
      // Een sessie die bij het exporteren nog liep, komt binnen als gestopt
      status: 'ended' as const,
      endedAt: s.endedAt ?? (lastObservation(s.id) || s.startedAt),
    }));
    await db.sessions.bulkAdd(added);
    await db.events.bulkAdd(await eventsToRestore(events, added));
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

/**
 * Het log binnen de tijd van de toegevoegde sessies (zoals `snapshot` in
 * share.ts het meestuurt), zonder het nummer uit de andere database en zonder
 * wat er hier al staat (zelfde tijd, soort en exemplaar).
 */
async function eventsToRestore(
  events: LogEvent[],
  sessions: { startedAt: number; endedAt: number }[],
): Promise<LogEvent[]> {
  const inSession = events.filter((e) =>
    sessions.some((s) => e.at >= s.startedAt && e.at <= s.endedAt),
  );
  if (!inSession.length) return [];
  const key = (e: LogEvent) => `${e.at}|${e.type}|${e.instance ?? ''}`;
  const first = Math.min(...inSession.map((e) => e.at));
  const last = Math.max(...inSession.map((e) => e.at));
  const present = new Set(
    (await db.events.where('at').between(first, last, true, true).toArray()).map(key),
  );
  const restored = new Map<string, LogEvent>();
  for (const { id: _, ...e } of inSession) if (!present.has(key(e))) restored.set(key(e), e);
  return [...restored.values()];
}

/** Uitkomst van een import in een zin, voor op het scherm */
export function describeImport({ added, skipped, feedback }: ImportResult): string {
  return [
    added === 0 ? t('import.none') : t('import.added', { n: added }),
    skipped > 0 && t('import.skipped', { n: skipped }),
    feedback > 0 && t('import.feedback', { n: feedback }),
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
  events?: unknown;
}): void {
  if (!Array.isArray(data?.sessions) || !Array.isArray(data?.utterances)) {
    throw new Error(t('import.notOurs'));
  }
  const fail = (what: string): never => {
    throw new Error(t('import.invalid', { what }));
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
      !optional(s.ebirdExportedAt, isNumber) ||
      !optional(s.reviewMs, isNumber) ||
      !optional(s.tuintelling, (b) => b === true) ||
      !optional(s.tuintelStartedAt, isNumber)
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
      // De taal kiest de prompt: alleen bekende talen (ontwikkeloptie "English")
      optional(u.language, (l) => l === 'nl' || l === 'en') &&
      // Het land van de soortenlijst (ontwikkeloptie "Spanje")
      optional(u.region, (r) => r === 'es') &&
      optional(u.handled, (h) => h === 'observation' || h === 'none') &&
      optional(u.interrupted, isNumber) &&
      optional(u.waitingFor, (w) => w === 'paused' || w === 'busy') &&
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
        optional(o.area, isArea) &&
        // Gaan letterlijk in het bestand voor waarneming.nl
        optional(o.obscurity, isObscurity) &&
        optional(o.embargoUntil, isDateString);
      if (!ok) fail('waarneming');
    }
  }
  const events = data.events ?? [];
  if (!Array.isArray(events)) fail('log');
  const isText = (value: unknown) => typeof value === 'string' && value.length <= 100;
  for (const e of events as LogEvent[]) {
    const ok =
      isNumber(e?.at) &&
      isText(e.type) &&
      optional(e.instance, isText) &&
      optional(e.sessionId, isText) &&
      optional(e.utteranceId, isText);
    if (!ok) fail('log');
  }
}
