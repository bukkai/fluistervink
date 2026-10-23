import { getTester, putShared } from './api';
import { db, type Utterance } from './db';
import { NO_SESSION } from './devNotes';
import { APP_VERSION, CHANNEL, logEvent } from './log';

// Delen met de ontwikkelaar: gestopte wandelingen (uitspraken, transcripten,
// uitvoer van het model, de nagelopen waarnemingen, feedback en het log van
// die periode) gaan naar de proxy, die ze per tester bewaart. Zo groeit de
// testset vanzelf, ook met andere stemmen dan die van de eigenaar. Opnames
// alleen als de gebruiker dat aanzet.
//
// Een wandeling gaat opnieuw als hij veranderd is (bv. na het nalopen): de app
// onthoudt per wandeling een hash van wat er verstuurd is. Lukt het niet, dan
// bij de volgende gelegenheid opnieuw (opstarten, weer online, ander scherm).

const ENABLED_KEY = 'fluistervink.share';
const AUDIO_KEY = 'fluistervink.shareAudio';
const SENT_KEY = 'fluistervink.shared';
/** Willekeurige id van dit apparaat (deze database), voor de losse feedback. */
const DEVICE_KEY = 'fluistervink.device';
const SENT_AT_KEY = 'fluistervink.sharedAt';

interface Sent {
  /** Hash van de laatst verstuurde versie per wandeling */
  sessions: Record<string, string>;
  /** Uitspraken waarvan de opname al verstuurd is */
  audio: string[];
  /** Feedback die verstuurd is (voor het Feedback-scherm) */
  notes?: string[];
}

/** Gaat af na een ronde en bij aan/uit, zodat schermen opnieuw kunnen lezen. */
export const SHARE_CHANGED = 'fluistervink:share-changed';

function changed(): void {
  window.dispatchEvent(new Event(SHARE_CHANGED));
}

/** Ids van feedback die al bij de ontwikkelaar is. */
export function sentNoteIds(): Set<string> {
  return new Set(read<Sent>(SENT_KEY, { sessions: {}, audio: [] }).notes ?? []);
}

/**
 * Feedback in een verstuurde (of al eerder verstuurde, zelfde hash) versie
 * van een wandeling als verstuurd noteren.
 */
function markNotes(sent: Sent, utterances: Pick<Utterance, 'id' | 'kind'>[]): void {
  const ids = new Set(sent.notes);
  const before = ids.size;
  for (const u of utterances) if (u.kind === 'dev_note') ids.add(u.id);
  if (ids.size !== before) sent.notes = [...ids];
}

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
    // Volle of geblokkeerde opslag: dan volgende keer alles opnieuw, geen ramp
  }
}

/**
 * Delen gebeurt pas na toestemming: het hoofdscherm vraagt het één keer (zie
 * shareChoiceMade), daarna aan of uit bij Instellingen.
 */
export function shareEnabled(): boolean {
  return read(ENABLED_KEY, false);
}

/** Heeft de gebruiker al gekozen of de app mag delen? */
export function shareChoiceMade(): boolean {
  return read<boolean | undefined>(ENABLED_KEY, undefined) !== undefined;
}

export function setShareEnabled(on: boolean): void {
  write(ENABLED_KEY, on);
  changed();
  if (on) scheduleShare();
}

/** Opnames meesturen staat standaard uit. */
export function shareAudio(): boolean {
  return read(AUDIO_KEY, false);
}

export function setShareAudio(on: boolean): void {
  write(AUDIO_KEY, on);
  if (on) scheduleShare();
}

/** Moment van de laatste geslaagde ronde, of undefined. */
export function lastSharedAt(): number | undefined {
  return read<number | undefined>(SENT_AT_KEY, undefined);
}

/** Alles van één wandeling, in de vorm van de JSON-export (zonder opnames). */
async function snapshot(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) return undefined;
  const until = session.endedAt ?? Date.now();
  const [utterances, observations, deletedObservations, events] = await Promise.all([
    db.utterances.where('sessionId').equals(sessionId).sortBy('recordedAt'),
    db.observations.where('sessionId').equals(sessionId).toArray(),
    db.deletedObservations.where('sessionId').equals(sessionId).toArray(),
    // Het log van de periode van de wandeling (`sessionId` heeft geen index)
    db.events.where('at').between(session.startedAt, until, true, true).toArray(),
  ]);
  return {
    sessions: [session],
    utterances: utterances.map(({ audio, ...u }: Utterance) => ({
      ...u,
      audioBytes: audio?.size,
      audioType: audio?.type,
    })),
    observations,
    deletedObservations,
    events,
  };
}

/** Zo ver terug gaat het log mee bij losse feedback, om te zien wat eraan voorafging. */
const LOOSE_EVENTS_MS = 30 * 60_000;

/**
 * Id waaronder losse feedback (buiten een wandeling) gedeeld wordt, per
 * apparaat. Eerst was het één vaste id per tester; dan overschreef de
 * Android-app wat de PWA in Chrome had gedeeld (elk een eigen database), en
 * andersom.
 */
function looseId(): string {
  let device = read<string | null>(DEVICE_KEY, null);
  if (!device) {
    device = crypto.randomUUID().slice(0, 8);
    write(DEVICE_KEY, device);
  }
  return `losse-feedback-${device}`;
}

/**
 * Feedback die buiten een wandeling getypt is (devNotes.ts), met het log van
 * het half uur ervoor. Zelfde vorm als een wandeling, zonder wandeling.
 */
async function looseSnapshot() {
  const notes = await db.utterances.where('sessionId').equals(NO_SESSION).sortBy('recordedAt');
  const events = (
    await Promise.all(
      notes.map((n) =>
        db.events
          .where('at')
          .between(n.recordedAt - LOOSE_EVENTS_MS, n.recordedAt, true, true)
          .toArray(),
      ),
    )
  ).flat();
  const unique = [...new Map(events.map((e) => [e.id, e])).values()].sort((a, b) => a.at - b.at);
  return {
    sessions: [],
    utterances: notes.map(({ audio: _audio, ...u }: Utterance) => u),
    observations: [],
    deletedObservations: [],
    events: unique,
  };
}

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest.slice(0, 12)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export interface ShareResult {
  sessions: number;
  audio: number;
}

let running: Promise<ShareResult> | undefined;

/**
 * Verstuurt wat nog niet (of in een oudere versie) verstuurd is. Eén ronde
 * tegelijk; een tweede aanroep wacht op de lopende.
 */
export function shareNow(): Promise<ShareResult> {
  running ??= run().finally(() => (running = undefined));
  return running;
}

async function run(): Promise<ShareResult> {
  const result = { sessions: 0, audio: 0 };
  if (!shareEnabled() || !navigator.onLine) return result;

  const sent = read<Sent>(SENT_KEY, { sessions: {}, audio: [] });
  const audioSent = new Set(sent.audio);
  const withAudio = shareAudio();

  try {
    // Alleen gestopte wandelingen: een lopende verandert nog bij elke uitspraak
    const ended = await db.sessions.where('status').equals('ended').primaryKeys();
    for (const id of ended) {
      const data = await snapshot(id);
      if (!data) continue;
      const body = JSON.stringify(data);
      const version = await hash(body);
      if (sent.sessions[id] !== version) {
        await putShared(
          `sessions/${id}`,
          new Blob(
            [
              JSON.stringify({
                sharedAt: new Date().toISOString(),
                appVersion: APP_VERSION,
                channel: CHANNEL,
                tester: getTester(),
                ...data,
              }),
            ],
            { type: 'application/json' },
          ),
        );
        sent.sessions[id] = version;
        result.sessions++;
      }
      markNotes(sent, data.utterances);
      write(SENT_KEY, sent);

      if (!withAudio) continue;
      // Opnames los, één voor één: ze veranderen nooit, dus maar één keer
      for (const u of data.utterances) {
        if (!u.audioBytes || audioSent.has(u.id)) continue;
        const audio = (await db.utterances.get(u.id))?.audio;
        if (!audio) continue;
        await putShared(`audio/${u.id}`, audio);
        audioSent.add(u.id);
        sent.audio = [...audioSent];
        write(SENT_KEY, sent);
        result.audio++;
      }
    }
    // Losse feedback: ook versturen als hij leeg is geworden (alles verwijderd),
    // zodat de verwijdering doorkomt
    const looseKey = looseId();
    const loose = await looseSnapshot();
    const looseVersion = await hash(JSON.stringify(loose));
    if (
      sent.sessions[looseKey] !== looseVersion &&
      (loose.utterances.length || sent.sessions[looseKey])
    ) {
      await putShared(
        `sessions/${looseKey}`,
        new Blob(
          [
            JSON.stringify({
              sharedAt: new Date().toISOString(),
              appVersion: APP_VERSION,
              channel: CHANNEL,
              tester: getTester(),
              ...loose,
            }),
          ],
          { type: 'application/json' },
        ),
      );
      sent.sessions[looseKey] = looseVersion;
      result.sessions++;
    }
    if (sent.sessions[looseKey] === looseVersion) markNotes(sent, loose.utterances);
    write(SENT_KEY, sent);

    write(SENT_AT_KEY, Date.now());
    if (result.sessions || result.audio) logEvent('shared', result);
  } catch (error) {
    logEvent('share_failed', {
      message: error instanceof Error ? error.message : String(error),
      ...result,
    });
    throw error;
  } finally {
    changed();
  }
  return result;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Een ronde over een paar seconden, en dan stil: bij elke schermwissel,
 * na het stoppen van een wandeling en bij weer online. Fouten alleen in het log.
 */
export function scheduleShare(delayMs = 3000): void {
  clearTimeout(timer);
  timer = setTimeout(() => shareNow().catch(() => {}), delayMs);
}
