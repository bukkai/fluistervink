import {
  db,
  audioBlob,
  isStoredAudio,
  storeAudio,
  type PositionLookup,
  type ProcessingMetrics,
  type Utterance,
} from './db';
import { ApiError } from './api';
import { applyActions } from './applyActions';
import { attachArea, fillMissingAreas } from './area';
import { devNoteText } from './devNotePrefix';
import { isEmptyTrektelChunk, utteranceFeedback, vibrate } from './feedback';
import { INSTANCE_ID } from './instance.svelte';
import { MODEL, interpret, promptVersionFor, type Interpretation } from './interpret';
import { currentPosition } from './location.svelte';
import { APP_VERSION, logEvent, wasHiddenSince } from './log';
import { PLATFORM } from './native';
import { listObservations, spokenAt } from './observations';
import { preferenceOn } from './preferences';
import type { Recording } from './recorder.svelte';
import { confirmAloud, confirmCatchUp } from './spoken';
import { placeFromSpeech } from './spokenPlace';
import { TRANSCRIBE_MODEL, transcribe, transcribePromptVersionFor } from './transcribe';
import { checkZeemeeuw } from './zeemeeuw.svelte';

// Local-first verwerking: elke uitspraak wordt eerst opgeslagen (status
// `pending`) en daarna één voor één, op volgorde, door het model gehaald.
// Normaal is de wachtrij direct leeg; bij een fout blijft de uitspraak bewaard
// en kan hij opnieuw. Zonder bereik wacht een uitspraak tot er weer
// verbinding is, en de rest van de wachtrij met hem (docs/plan-offline.md).

/** Slaat een getypte uitspraak op en zet hem in de wachtrij. */
export async function submitText(sessionId: string, text: string): Promise<void> {
  // Positie opvragen op het moment van de uitspraak, maar niet erop wachten:
  // de uitspraak wordt meteen opgeslagen en verwerkt.
  await submit({ sessionId, recordedAt: Date.now(), transcript: text.trim() }, currentPosition());
}

/**
 * Slaat een opname op en zet hem in de wachtrij; de spraakherkenning is de
 * eerste verwerkingsstap.
 * @param lookup Positie, opgevraagd bij het indrukken van de opnameknop
 */
export async function submitRecording(
  sessionId: string,
  recording: Recording,
  lookup: Promise<PositionLookup>,
  options: { trektel?: boolean } = {},
): Promise<void> {
  await submit(
    {
      sessionId,
      recordedAt: recording.startedAt,
      audio: await storeAudio(recording.audio),
      audioDurationMs: recording.durationMs,
      ...(options.trektel && { trektel: true }),
    },
    lookup,
  );
}

async function submit(
  fields: Pick<
    Utterance,
    'sessionId' | 'recordedAt' | 'transcript' | 'audio' | 'audioDurationMs' | 'trektel'
  >,
  lookup: Promise<PositionLookup>,
): Promise<void> {
  const id = crypto.randomUUID();
  await db.utterances.add({ id, ...fields, savedAt: Date.now(), status: 'pending' });
  // Wacht de wachtrij op bereik, dan komt er voorlopig geen antwoord: meteen
  // "bewaard, wacht op bereik". Niet bij een trektelstuk (dat knipt de app
  // zelf, elke minuut).
  if (!fields.trektel && listening) vibrate('waiting');
  processQueue();
  attachPosition(id, lookup);
}

/**
 * Koppelt de positie aan de uitspraak zodra die bekend is. Is de uitspraak
 * dan al verwerkt, dan krijgen de waarnemingen eruit de positie alsnog.
 * Daarna het gebied van waarneming.nl, op dezelfde manier.
 */
async function attachPosition(utteranceId: string, pending: Promise<PositionLookup>) {
  const { position, ...positionLookup } = await pending;
  if (!position) {
    await db.utterances.update(utteranceId, { positionLookup });
    return;
  }
  await db.transaction('rw', db.utterances, db.observations, async () => {
    await db.utterances.update(utteranceId, { position, positionLookup });
    await db.observations
      .where('utteranceId')
      .equals(utteranceId)
      .modify((obs) => {
        if (!obs.position) {
          // Plek genoemd in de uitspraak ("500 m zuid"): vanaf de GPS uitrekenen
          if (obs.spokenPlace) Object.assign(obs, placeFromSpeech(position, obs.spokenPlace));
          else obs.position = position;
        }
        // Al met de hand gezet: de GPS wordt de plek om naar terug te gaan
        else if (obs.recordedPosition === null) obs.recordedPosition = position;
      });
  });
  await attachArea(utteranceId, position);
}

const audioLimitListeners = new Set<() => void>();

/**
 * Het plafond per dag is bereikt (proxy, `audio_limit`): het sessiescherm
 * stopt dan een lopende trektelling, die anders stukken blijft opnemen die
 * toch niet verwerkt worden. Geeft een functie om af te melden.
 */
export function onAudioLimit(listener: () => void): () => void {
  audioLimitListeners.add(listener);
  return () => audioLimitListeners.delete(listener);
}

export async function retry(utteranceId: string): Promise<void> {
  await db.utterances.update(utteranceId, { status: 'pending', error: undefined });
  processQueue();
}

let running = false;

const QUEUE_LOCK = 'fluistervink-queue';

/**
 * Zo lang mag een zichtbaar exemplaar op het slot wachten voordat het dat
 * afpakt. Ruim langer dan een normale verwerking (spraak + model ±5 s).
 */
export const STEAL_AFTER_MS = 10_000;

/** Wachten op het slot of de database vanaf zoveel ms in de log */
const SLOW_MS = 1000;

/**
 * Verwerkt alle wachtende uitspraken op volgorde. Wordt na elke nieuwe
 * uitspraak aangeroepen; een tweede aanroep terwijl hij loopt doet niets.
 *
 * Het slot (Web Locks) zorgt dat maar één exemplaar van de app tegelijk
 * verwerkt, ook als hij in een tabblad én als geïnstalleerde app openstaat.
 * Bij het opstarten (`takeOver`) pakt dit exemplaar het slot af: het andere
 * kan bevroren op de achtergrond staan en het anders nooit loslaten.
 */
export async function processQueue({ takeOver = false } = {}): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (navigator.locks) {
      await withQueueLock(takeOver);
    } else {
      await runQueue();
    }
  } catch (error) {
    // Slot afgepakt door een ander exemplaar (dat dan zelf verder verwerkt)
    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
  } finally {
    running = false;
  }
}

/**
 * Verwerkt met het slot in handen. Houdt een ander exemplaar het slot langer
 * dan `STEAL_AFTER_MS` vast terwijl dit exemplaar zichtbaar is, dan pakt dit
 * het af: het andere staat dan vrijwel zeker bevroren op de achtergrond
 * (wachtrij 3 minuten stil na een herstart, 11 okt). Dubbel opslaan kan niet:
 * een poging van het andere exemplaar telt dan niet meer (`isCurrentAttempt`).
 */
async function withQueueLock(takeOver: boolean): Promise<void> {
  const requestedAt = Date.now();
  let granted = false;
  const run = async (stolen: boolean) => {
    granted = true;
    const waitedMs = Date.now() - requestedAt;
    if (waitedMs >= SLOW_MS) logEvent('queue_lock_waited', { waitedMs, stolen });
    await runQueue();
  };
  if (takeOver) {
    await navigator.locks.request(QUEUE_LOCK, { steal: true }, () => run(false));
    return;
  }

  const waiting = new AbortController();
  let checking = false;
  const watchdog = setInterval(async () => {
    if (granted || checking || document.hidden) return;
    checking = true;
    // Wie houdt het slot vast? Om in de log te zien hoe het zat
    const { held = [], pending = [] }: LockManagerSnapshot = await navigator.locks
      .query()
      .catch(() => ({}));
    checking = false;
    if (granted) return;
    clearInterval(watchdog);
    logEvent('queue_lock_stolen', {
      waitedMs: Date.now() - requestedAt,
      held: held.filter((lock) => lock.name === QUEUE_LOCK).map((lock) => lock.clientId),
      pending: pending.filter((lock) => lock.name === QUEUE_LOCK).length,
    });
    waiting.abort();
  }, STEAL_AFTER_MS);

  try {
    await navigator.locks.request(QUEUE_LOCK, { signal: waiting.signal }, () => run(false));
  } catch (error) {
    if (!waiting.signal.aborted || granted) throw error;
    await navigator.locks.request(QUEUE_LOCK, { steal: true }, () => run(true));
  } finally {
    clearInterval(watchdog);
  }
}

async function runQueue(): Promise<void> {
  // Uitspraken die bleven hangen (app afgesloten tijdens verwerken) opnieuw.
  // Kan veilig: wie het slot heeft, is de enige die verwerkt.
  // Hoe lang de eerste databasestap duurt: houdt een ander exemplaar de
  // database vast, dan wacht deze (zie instance.svelte.ts)
  const dbStart = Date.now();
  const stuck = await db.utterances.where('status').equals('processing').toArray();
  const dbMs = Date.now() - dbStart;
  if (dbMs >= SLOW_MS) logEvent('queue_db_slow', { dbMs });
  await (audioMigration ??= migrateOnce());
  for (const u of stuck) {
    logEvent('requeued', undefined, { sessionId: u.sessionId, utteranceId: u.id });
    await db.utterances
      .update(u.id, { status: 'pending' })
      .catch((error) => queueError(error, u, 'requeue'));
  }

  // Uitspraken waarbij de database zelf faalde: niet steeds opnieuw, zodat
  // de uitspraken erna toch verwerkt worden
  const skipped = new Set<string>();
  let waiting = false;
  // Inhalen na lang wachten: geen tril per uitspraak, maar één aan het eind
  let catchUp: { before: number; done: number; failed: number } | undefined;
  // Sessies waarvan na het wachten uitspraken verwerkt zijn: gebieden en naam
  // alsnog (ook van een sessie die intussen gestopt is)
  const resumed = new Set<string>();
  while (true) {
    const pending = await db.utterances.where('status').equals('pending').sortBy('recordedAt');
    const next = pending.find((u) => !skipped.has(u.id));
    if (!next) break;
    try {
      // Geen bereik: stoppen, zodat latere uitspraken niet eerder verwerkt
      // worden ("nee, keep" moet de waarneming ervoor al kunnen vinden)
      if ((await processUtterance(next)) === 'wait') {
        waiting = true;
        // Net begonnen met wachten (niet bij elke nieuwe poging)
        if (!next.waitingSince && !next.trektel) vibrate('waiting');
        checkLongWait(next.waitingSince ?? Date.now(), pending.length);
        break;
      }
    } catch (error) {
      queueError(error, next, 'process');
      skipped.add(next.id);
      continue;
    }
    const processed = await db.utterances.get(next.id);
    if (next.waitingSince && processed?.status !== 'pending') {
      const waitedMs = Date.now() - next.waitingSince;
      logEvent(
        'queue_resumed',
        { waitedMs, count: pending.length },
        { sessionId: next.sessionId, utteranceId: next.id },
      );
      retryStep = 0;
      if (waitedMs >= CATCH_UP_AFTER_MS) catchUp = { before: Date.now(), done: 0, failed: 0 };
      resumed.add(next.sessionId);
    } else if (resumed.size) {
      resumed.add(next.sessionId);
    }
    if (!processed || isEmptyTrektelChunk(processed)) continue;
    // Ingesproken vóór het inhalen begon: tellen in plaats van trillen
    if (catchUp && (processed.savedAt ?? processed.recordedAt) < catchUp.before) {
      if (processed.status === 'failed') catchUp.failed++;
      else catchUp.done++;
      continue;
    }
    vibrate(utteranceFeedback(processed));
    // Niet wachten: de volgende uitspraak hoeft niet op de stem te wachten
    confirmAloud(processed).catch(() => {});
  }
  if (waiting) waitForNetwork();
  else stopWaiting();
  if (catchUp && !waiting && catchUp.done + catchUp.failed > 0) {
    vibrate(catchUp.failed ? 'failed' : 'saved');
    confirmCatchUp(catchUp.done, catchUp.failed).catch(() => {});
  }
  for (const sessionId of resumed) fillMissingAreas(sessionId).catch(() => {});
}

/**
 * Wie langer dan zo lang op bereik wachtte, krijgt na het verwerken niet per
 * uitspraak een tril (twintig trillen achter elkaar helpen niemand), maar één.
 */
export const CATCH_UP_AFTER_MS = 60_000;

/**
 * Fouten waarbij wachten helpt: geen verbinding of een time-out (status 0),
 * en de proxy of een aanbieder die even weg is. Een plafond (429), geweigerde
 * toegang (401, 403) of een ongeldig verzoek (400) blijft mislukt.
 */
const TEMPORARY_STATUS = new Set([0, 502, 503, 504, 529]);

function isTemporary(error: unknown): boolean {
  return error instanceof ApiError && TEMPORARY_STATUS.has(error.status);
}

/**
 * Wanneer de wachtrij het opnieuw probeert terwijl er een uitspraak op bereik
 * wacht; daarna elke 2 minuten. Los van het `online`-event, want
 * `navigator.onLine` liegt soms (wifi zonder internet, één streepje 4G).
 */
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

let retryStep = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** Er wacht een uitspraak op bereik: timer en luisteraars staan aan */
let listening = false;

const resume = () => {
  processQueue();
};
const resumeWhenVisible = () => {
  if (!document.hidden) processQueue();
};

/** Opnieuw proberen op de timer, bij weer online en als de app weer op het scherm komt. */
function waitForNetwork(): void {
  clearTimeout(retryTimer);
  const delay = RETRY_DELAYS_MS[Math.min(retryStep, RETRY_DELAYS_MS.length - 1)];
  retryStep++;
  retryTimer = setTimeout(resume, delay);
  if (listening) return;
  listening = true;
  window.addEventListener('online', resume);
  document.addEventListener('visibilitychange', resumeWhenVisible);
}

/**
 * Na zo lang wachten op bereik een melding (trektelling: de stukken stapelen
 * zich op, ongeveer 120 in 2 uur). De telling stopt niet vanzelf.
 */
export const LONG_WAIT_MS = 2 * 60 * 60_000;

const longWaitListeners = new Set<(count: number) => void>();
let longWaitNotified = false;

/**
 * Er wordt al `LONG_WAIT_MS` op bereik gewacht: één keer per keer wachten,
 * met het aantal wachtende uitspraken. Geeft een functie om af te melden.
 */
export function onLongWait(listener: (count: number) => void): () => void {
  longWaitListeners.add(listener);
  return () => longWaitListeners.delete(listener);
}

function checkLongWait(since: number, count: number): void {
  if (longWaitNotified || Date.now() - since < LONG_WAIT_MS) return;
  longWaitNotified = true;
  logEvent('queue_long_wait', { waitedMs: Date.now() - since, count });
  for (const listener of longWaitListeners) listener(count);
}

/** Er wacht niets meer: timer en luisteraars weg. Ook voor de tests. */
export function stopWaiting(): void {
  clearTimeout(retryTimer);
  retryTimer = undefined;
  retryStep = 0;
  longWaitNotified = false;
  if (!listening) return;
  listening = false;
  window.removeEventListener('online', resume);
  document.removeEventListener('visibilitychange', resumeWhenVisible);
}

function queueError(error: unknown, u: Utterance, step: 'requeue' | 'process' | 'migrate'): void {
  const message = error instanceof Error ? error.message : String(error);
  logEvent('queue_error', { step, message }, { sessionId: u.sessionId, utteranceId: u.id });
}

let audioMigration: Promise<void> | undefined;

/** Gezet als alle opnames bytes zijn; nieuwe opnames zijn dat altijd. */
const AUDIO_MIGRATED_KEY = 'fluistervink.audioMigrated';

/**
 * `migrateAudio` één keer per apparaat: daarna hoeft de app niet bij elke
 * start alle opnames te lezen. Mislukt het, dan loopt de wachtrij gewoon door
 * en probeert de volgende ronde het opnieuw.
 */
async function migrateOnce(): Promise<void> {
  // Opslag geblokkeerd: dan elke start opnieuw, maar wel migreren
  const storage = {
    done: () => {
      try {
        return !!localStorage.getItem(AUDIO_MIGRATED_KEY);
      } catch {
        return false;
      }
    },
    mark: () => {
      try {
        localStorage.setItem(AUDIO_MIGRATED_KEY, '1');
      } catch {
        // Dan de volgende start opnieuw kijken
      }
    },
  };
  try {
    if (storage.done()) return;
    if (await migrateAudio()) storage.mark();
  } catch (error) {
    audioMigration = undefined;
    logEvent('queue_error', {
      step: 'migrate',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Zet opnames die nog als Blob in de database staan om (zie `StoredAudio` in
 * db.ts), één keer per start. Is een Blob niet meer te lezen, dan gaat hij
 * eruit: zonder opname kan de uitspraak niet meer verwerkt worden, maar houdt
 * hij de rest van de wachtrij ook niet meer op. Geeft false als er een
 * opname niet weggeschreven kon worden (dan de volgende start opnieuw).
 */
export async function migrateAudio(): Promise<boolean> {
  let complete = true;
  const failed = (error: unknown, u: Utterance) => {
    queueError(error, u, 'migrate');
    complete = false;
  };
  const ids = await db.utterances.filter((u) => !!u.audio && !isStoredAudio(u.audio)).primaryKeys();
  for (const id of ids) {
    const u = await db.utterances.get(id);
    if (!u?.audio || isStoredAudio(u.audio)) continue;
    let audio;
    try {
      audio = await storeAudio(u.audio);
    } catch (error) {
      queueError(error, u, 'migrate');
      const waiting = u.transcript === undefined && u.status !== 'done';
      await db.utterances
        .update(id, {
          audio: undefined,
          ...(waiting && { status: 'failed', error: 'Opname niet meer te lezen' }),
        })
        .catch((error) => failed(error, u));
      continue;
    }
    await db.utterances.update(id, { audio }).catch((error) => failed(error, u));
  }
  return complete;
}

/**
 * Is deze verwerkingspoging nog de geldige? Een exemplaar dat bevroren was
 * en weer ontdooit, kan een poging afmaken die een ander intussen opnieuw
 * deed; dan het resultaat weggooien in plaats van dubbel opslaan.
 */
function isCurrentAttempt(latest: Utterance | undefined, attempts: number): latest is Utterance {
  return latest?.status === 'processing' && latest.attempts === attempts;
}

/** Verwerkt één uitspraak; `wait` als hij op bereik moet wachten. */
async function processUtterance(utterance: Utterance): Promise<'wait' | void> {
  const startedAt = Date.now();
  const attempts = (utterance.attempts ?? 0) + 1;
  const ids = { sessionId: utterance.sessionId, utteranceId: utterance.id };
  await db.utterances.update(utterance.id, { status: 'processing', attempts });
  // Ook andere dieren (keuze bij Instellingen, standaard aan): een andere prompt
  const groups = preferenceOn('soortgroepen');

  let step: 'transcribe' | 'interpret' = 'transcribe';
  let interpretation: Interpretation;
  let contextMs: number | undefined;
  try {
    // Opname: eerst spraak naar tekst. Na een fout bij de interpretatie blijft
    // het transcript bewaard, zodat "Opnieuw" alleen die stap herhaalt.
    if (utterance.transcript === undefined && utterance.audio) {
      utterance = await transcribeUtterance(utterance);
    }
    const transcript = utterance.transcript ?? '';
    checkZeemeeuw(transcript);

    // Feedback gaat niet naar het model: snel, gratis en altijd goed herkend.
    // Behalve in een trektelling: daar knipt de app zelf, dus een stuk dat met
    // "feedback" begint, kan daarna nog waarnemingen bevatten.
    if (!utterance.trektel && devNoteText(transcript) !== undefined) {
      await finishWithout(utterance.id, attempts, { kind: 'dev_note', result: 'note' });
      return;
    }
    // Niets verstaan (wind, per ongeluk ingedrukt): niet naar het model
    if (!transcript) {
      await finishWithout(utterance.id, attempts, { result: 'ignored' });
      return;
    }

    step = 'interpret';
    const contextStart = Date.now();
    // Positie vers uit de database: de GPS kan na het opslaan van de uitspraak binnengekomen zijn
    const [recent, fresh] = await Promise.all([
      listObservations(utterance.sessionId),
      db.utterances.get(utterance.id),
    ]);
    const here = fresh?.position;
    contextMs = Date.now() - contextStart;
    interpretation = await interpret(transcript, recent, {
      here,
      sessionId: utterance.sessionId,
      groups,
      trektel: utterance.trektel,
    });
    if (interpretation.warnings.length) {
      logEvent('species_id_fixed', { warnings: interpretation.warnings }, ids);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof ApiError ? error.status : undefined;
    if (isTemporary(error)) {
      // Eén keer in de log bij het begin van het wachten, niet per poging
      if (!utterance.waitingSince) {
        logEvent(
          'queue_waiting',
          { attempt: attempts, step, error: message, status, online: navigator.onLine },
          ids,
        );
      }
      const waitingSince = utterance.waitingSince ?? Date.now();
      await db.transaction('rw', db.utterances, async () => {
        const latest = await db.utterances.get(utterance.id);
        if (isCurrentAttempt(latest, attempts))
          await db.utterances.update(utterance.id, { status: 'pending', waitingSince });
      });
      return 'wait';
    }
    // In de log, want een volgende poging overschrijft de fout bij de uitspraak
    logEvent(
      'attempt_failed',
      {
        attempt: attempts,
        step,
        error: message,
        status,
        waitedMs: startedAt - spokenAt(utterance),
        durationMs: Date.now() - startedAt,
        wasHidden: wasHiddenSince(utterance.recordedAt),
        online: navigator.onLine,
      },
      ids,
    );
    const prefix = step === 'transcribe' ? 'Spraakherkenning: ' : '';
    await db.transaction('rw', db.utterances, async () => {
      const latest = await db.utterances.get(utterance.id);
      if (isCurrentAttempt(latest, attempts))
        await db.utterances.update(utterance.id, {
          status: 'failed',
          error: prefix + message,
          waitingSince: undefined,
        });
    });
    // De opname blijft bewaard: morgen met "Opnieuw" alsnog verwerken
    if (error instanceof ApiError && error.code === 'audio_limit') {
      for (const listener of audioLimitListeners) listener();
    }
    return;
  }

  const metrics: ProcessingMetrics = {
    appVersion: APP_VERSION,
    platform: PLATFORM,
    model: MODEL,
    promptVersion: await promptVersionFor(groups),
    context: interpretation.context,
    contextIds: interpretation.contextIds,
    instance: INSTANCE_ID,
    startedAt,
    finishedAt: Date.now(),
    ...interpretation.timing,
    contextMs,
    wasHidden: wasHiddenSince(utterance.recordedAt),
    online: navigator.onLine,
  };

  const saveStart = Date.now();
  await db.transaction('rw', db.observations, db.deletedObservations, db.utterances, async () => {
    // Opnieuw ophalen: de positie kan intussen binnengekomen zijn
    const latest = await db.utterances.get(utterance.id);
    if (!isCurrentAttempt(latest, attempts)) {
      logEvent('stale_result', { attempt: attempts }, ids);
      return;
    }
    const changes = await applyActions(latest, interpretation.actions);
    const touched = await db.observations.bulkGet(
      changes.flatMap((c) => (c.type === 'delete' ? [] : [c.observationId])),
    );
    const uncertain = touched.some((obs) => obs?.uncertain);
    const notes = interpretation.actions.filter((a) => a.type === 'dev_note');
    // Alleen feedback: de uitspraak zelf wordt feedback. Feedback tussen
    // waarnemingen (vooral in een trektelling) wordt een eigen uitspraak, zodat
    // de waarnemingen gewone waarnemingen blijven.
    const devNote = notes.length > 0 && notes.length === interpretation.actions.length;
    if (!devNote) {
      for (const [i, note] of notes.entries()) {
        await db.utterances.add({
          id: crypto.randomUUID(),
          sessionId: latest.sessionId,
          recordedAt: latest.recordedAt + i + 1,
          savedAt: Date.now(),
          ...(latest.position && { position: latest.position }),
          transcript: note.text ?? latest.transcript,
          status: 'done',
          kind: 'dev_note',
          result: 'note',
          fromUtteranceId: latest.id,
        });
      }
    }

    await db.utterances.update(utterance.id, {
      status: 'done',
      waitingSince: undefined,
      llmOutput: interpretation.response,
      metrics: { ...metrics, saveMs: Date.now() - saveStart },
      changes,
      // Alleen feedback (een trektelstuk dat met "feedback" begint, of het woord
      // verhaspeld door de spraakherkenning): de uitspraak wordt feedback
      ...(devNote
        ? { kind: 'dev_note' as const, result: 'note' as const }
        : {
            result:
              interpretation.actions.length === 0 ? 'ignored' : uncertain ? 'uncertain' : 'saved',
          }),
      error: interpretation.rejected.length ? interpretation.rejected.join('; ') : undefined,
    });
  });
}

/** Afronden zonder model (feedback, niets verstaan), als de poging nog geldt. */
async function finishWithout(
  utteranceId: string,
  attempts: number,
  fields: Pick<Utterance, 'kind' | 'result'>,
): Promise<void> {
  await db.transaction('rw', db.utterances, async () => {
    const latest = await db.utterances.get(utteranceId);
    if (isCurrentAttempt(latest, attempts))
      await db.utterances.update(utteranceId, {
        status: 'done',
        waitingSince: undefined,
        ...fields,
      });
  });
}

/** Zet de opname om in tekst en slaat het transcript op. */
async function transcribeUtterance(utterance: Utterance): Promise<Utterance> {
  const groups = preferenceOn('soortgroepen');
  const { text, confidence, timing } = await transcribe(audioBlob(utterance.audio!), {
    sessionId: utterance.sessionId,
    groups,
  });
  const changes = {
    transcript: text,
    transcription: {
      model: TRANSCRIBE_MODEL,
      promptVersion: await transcribePromptVersionFor(groups),
      ...timing,
      confidence,
    },
  };
  await db.utterances.update(utterance.id, changes);
  return { ...utterance, ...changes };
}
