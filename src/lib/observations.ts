import {
  db,
  audioBlob,
  isStoredAudio,
  storeAudio,
  type Change,
  type DeletedObservation,
  type Observation,
  type PositionLookup,
  type ProcessingMetrics,
  type Utterance,
} from './db';
import { ApiError } from './api';
import { attachArea } from './area';
import { utteranceFeedback, vibrate } from './feedback';
import { confirmAloud } from './spoken';
import { MODEL, interpret, promptVersionFor, type Action, type Interpretation } from './interpret';
import { currentPosition } from './location.svelte';
import { placeFromSpeech, placeReason, type Place } from './spokenPlace';
import { INSTANCE_ID } from './instance.svelte';
import { APP_VERSION, logEvent, wasHiddenSince } from './log';
import type { Recording } from './recorder.svelte';
import { devOptionOn } from './devOptions';
import { preferenceOn } from './preferences';
import { rarityOf } from './rarity';
import {
  TRANSCRIBE_MODEL,
  isPromptExample,
  transcribe,
  transcribePromptVersion,
} from './transcribe';
import { checkZeemeeuw } from './zeemeeuw.svelte';
import { devNoteText } from './devNotePrefix';

export { devNoteText };
import {
  DEFAULT_ACTIVITY,
  DEFAULT_COUNTING_METHOD,
  DEFAULT_METHOD,
  getSpecies,
  isVagrant,
  speciesName,
} from './vocab';
import { PLATFORM } from './native';

// Local-first verwerking: elke uitspraak wordt eerst opgeslagen (status
// `pending`) en daarna één voor één, op volgorde, door het model gehaald.
// Normaal is de wachtrij direct leeg; bij een fout blijft de uitspraak bewaard
// en kan hij opnieuw.

/** Waarnemingen van een sessie, nieuwste eerst. */
export async function listObservations(sessionId: string): Promise<Observation[]> {
  const all = await db.observations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.observedAt - a.observedAt || b.createdAt - a.createdAt);
}

/** Uitspraken van een sessie, nieuwste eerst. */
export async function listUtterances(sessionId: string): Promise<Utterance[]> {
  const all = await db.utterances.where('sessionId').equals(sessionId).sortBy('recordedAt');
  return all.reverse();
}

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

/** Einde van de uitspraak: bij een opname het einde van de opname. */
export function spokenAt(utterance: Utterance): number {
  return utterance.recordedAt + (utterance.audioDurationMs ?? 0);
}

/**
 * Handmatige correctie in de review. De waarneming geldt daarna als
 * nagelopen; met de stem kan hij nog steeds aangepast worden.
 */
export async function editObservation(id: string, patch: Partial<Observation>): Promise<void> {
  await db.observations.update(id, { ...patch, editedAt: Date.now(), status: 'reviewed' });
}

/** Nauwkeurigheid van een met de hand gezette plek, in meters */
export const HAND_ACCURACY = 10;

export type { Place };

/**
 * Plek met de hand gezet (tikken of slepen op de kaart). De GPS-positie
 * blijft bewaard in `recordedPosition`, ook als de plek vaker verzet wordt.
 * Als meettijd de tijd van de waarneming, zodat er geen "positie oud" staat.
 * Met "Mijn plek nu" op het kaartje de nauwkeurigheid van die GPS-meting
 * (afgerond, niet beter dan HAND_ACCURACY).
 */
export function placeByHand(
  current: Place,
  observedAt: number,
  lat: number,
  lon: number,
  accuracy = HAND_ACCURACY,
): Place {
  return {
    position: {
      lat,
      lon,
      accuracy: Math.max(HAND_ACCURACY, Math.round(accuracy)),
      fixedAt: observedAt,
    },
    placedByVoice: undefined,
    recordedPosition:
      current.recordedPosition !== undefined
        ? current.recordedPosition
        : (current.position ?? null),
  };
}

/** Terug naar de plek van de GPS ("Terug naar de opgenomen plek") */
export function recordedPlace(current: Place): Place {
  if (current.recordedPosition === undefined) return current;
  return {
    position: current.recordedPosition ?? undefined,
    recordedPosition: undefined,
    placedByVoice: undefined,
  };
}

/**
 * Kopie van een waarneming, om er in de review een tweede van te maken ("4
 * wilde eenden en een winterkoning" werd alleen een winterkoning). Zelfde
 * tijd, locatie, bron-uitspraak en velden, maar een eigen id (gaat mee naar
 * waarneming.nl), als concept en niet onzeker. Geeft het nieuwe id terug.
 */
export async function copyObservation(id: string): Promise<string | undefined> {
  const original = await db.observations.get(id);
  if (!original) return undefined;
  const {
    editedAt: _edited,
    uncertainReason: _reason,
    candidates: _candidates,
    skipExport: _skip,
    ...fields
  } = original;
  const copy: Observation = {
    ...fields,
    id: crypto.randomUUID(),
    // Later aangemaakt, dus in de lijst direct boven het origineel
    createdAt: Math.max(Date.now(), original.createdAt + 1),
    uncertain: false,
    status: 'draft',
  };
  await db.observations.add(copy);
  return copy.id;
}

/** Onzekere waarneming nagelopen en goed bevonden ("Klopt") */
export async function confirmObservation(id: string): Promise<void> {
  await editObservation(id, {
    uncertain: false,
    uncertainReason: undefined,
    candidates: undefined,
  });
}

/** Twijfel tussen soorten opgelost: deze kandidaat was het */
export async function chooseCandidate(id: string, speciesId: number): Promise<void> {
  await editObservation(id, {
    speciesId,
    uncertain: false,
    uncertainReason: undefined,
    candidates: undefined,
  });
}

/**
 * Waarneming wel of niet meenemen in de export. Telt niet als correctie
 * (geen `editedAt`), want de waarneming zelf verandert niet.
 */
export async function setSkipExport(id: string, skip: boolean): Promise<void> {
  await db.observations.update(id, { skipExport: skip || undefined });
}

/** Verwijderde waarnemingen van een sessie, laatst verwijderd eerst. */
export async function listDeleted(sessionId: string): Promise<DeletedObservation[]> {
  const all = await db.deletedObservations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Verwijdert een waarneming met de hand; hij gaat naar de prullenbak. */
export async function deleteObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.deletedObservations, () => moveToBin(id, 'hand'));
}

/** Zet een verwijderde waarneming terug in de lijst. */
export async function restoreObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.deletedObservations, async () => {
    const deleted = await db.deletedObservations.get(id);
    if (!deleted) return;
    const { deletedAt: _at, deletedBy: _by, ...observation } = deleted;
    await db.observations.put(observation);
    await db.deletedObservations.delete(id);
  });
}

/** Verplaatst een waarneming naar de prullenbak; geeft hem terug zoals hij was. */
async function moveToBin(
  id: string,
  deletedBy: DeletedObservation['deletedBy'],
): Promise<Observation | undefined> {
  const observation = await db.observations.get(id);
  if (!observation) return undefined;
  await db.deletedObservations.put({ ...observation, deletedAt: Date.now(), deletedBy });
  await db.observations.delete(id);
  return observation;
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
  while (true) {
    const pending = await db.utterances.where('status').equals('pending').sortBy('recordedAt');
    const next = pending.find((u) => !skipped.has(u.id));
    if (!next) break;
    try {
      await processUtterance(next);
    } catch (error) {
      queueError(error, next, 'process');
      skipped.add(next.id);
      continue;
    }
    const processed = await db.utterances.get(next.id);
    if (processed) {
      vibrate(utteranceFeedback(processed));
      // Niet wachten: de volgende uitspraak hoeft niet op de stem te wachten
      confirmAloud(processed).catch(() => {});
    }
  }
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

async function processUtterance(utterance: Utterance): Promise<void> {
  const startedAt = Date.now();
  const attempts = (utterance.attempts ?? 0) + 1;
  const ids = { sessionId: utterance.sessionId, utteranceId: utterance.id };
  await db.utterances.update(utterance.id, { status: 'processing', attempts });
  // Twijfel tussen soorten (ontwikkeloptie): een andere prompt, dus een eigen versie
  const candidates = devOptionOn('kandidaten');

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
      candidates,
    });
    if (interpretation.warnings.length) {
      logEvent('species_id_fixed', { warnings: interpretation.warnings }, ids);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // In de log, want een volgende poging overschrijft de fout bij de uitspraak
    logEvent(
      'attempt_failed',
      {
        attempt: attempts,
        step,
        error: message,
        status: error instanceof ApiError ? error.status : undefined,
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
        await db.utterances.update(utterance.id, { status: 'failed', error: prefix + message });
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
    promptVersion: await promptVersionFor(candidates),
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
      llmOutput: interpretation.response,
      metrics: { ...metrics, saveMs: Date.now() - saveStart },
      changes,
      // Het model herkende een dev note zonder "dev note" ervoor
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

/** Afronden zonder model (dev note, niets verstaan), als de poging nog geldt. */
async function finishWithout(
  utteranceId: string,
  attempts: number,
  fields: Pick<Utterance, 'kind' | 'result'>,
): Promise<void> {
  await db.transaction('rw', db.utterances, async () => {
    const latest = await db.utterances.get(utteranceId);
    if (isCurrentAttempt(latest, attempts))
      await db.utterances.update(utteranceId, { status: 'done', ...fields });
  });
}

/** Zet de opname om in tekst en slaat het transcript op. */
async function transcribeUtterance(utterance: Utterance): Promise<Utterance> {
  const { text, confidence, timing } = await transcribe(audioBlob(utterance.audio!), {
    sessionId: utterance.sessionId,
  });
  const changes = {
    transcript: text,
    transcription: {
      model: TRANSCRIBE_MODEL,
      promptVersion: await transcribePromptVersion,
      ...timing,
      confidence,
    },
  };
  await db.utterances.update(utterance.id, changes);
  return { ...utterance, ...changes };
}

/** Vanaf deze lengte valt een opname met (bijna) geen tekst op. */
const ACCIDENTAL_MIN_MS = 3_500;
/** Minder woorden per seconde dan dit = (bijna) geen spraak. */
const ACCIDENTAL_MAX_WORDS_PER_S = 0.3;
/** Zoveel woorden verzint de spraakherkenning niet uit geritsel */
const ACCIDENTAL_MAX_WORDS = 6;

/**
 * Een opname met bijna geen tekst voor zijn lengte is vrijwel zeker per ongeluk
 * gemaakt (in de broekzak): de spraakherkenning verzint dan een paar woorden
 * uit het geritsel, vaak een soortnaam uit de prompt. 12 okt: 20 s opname,
 * "Roodhalsfuut" (0,05 woord/s), en in de bus 3,9 s "Bosuil" (0,26 woord/s).
 * Echte uitspraken halen 0,5 of meer, ook één soortnaam ("Boomklever", 1,9 s).
 * Een echte trage uitspraak wordt hooguit onzeker, en dat zie je bij het nalopen.
 * Niet bij een lijst van zes woorden of meer, en niet in de trektelmodus: wie
 * naar de lucht kijkt en tussendoor soorten noemt, haalt makkelijk minder dan
 * 0,3 woord/s (Maarten, 8 nov: 45 s, 13 woorden, alles werd onzeker). Daar
 * houdt de spraakdetectie stille stukken al tegen.
 * Volume en de zekerheid van de spraakherkenning bleken geen goed signaal:
 * geritsel is luider dan fluisteren, en de zekerheid wisselt per poging.
 */
export function isAccidental(
  utterance: Pick<
    Utterance,
    'audioDurationMs' | 'transcript' | 'audio' | 'audioDeletedAt' | 'trektel'
  >,
): boolean {
  if (utterance.trektel) return false;
  const ms = utterance.audioDurationMs;
  // Opgenomen (ook als de opname daarna gewist is), niet getypt
  const recorded = !!utterance.audio || utterance.audioDeletedAt !== undefined;
  if (!recorded || !ms || ms < ACCIDENTAL_MIN_MS) return false;
  const words = (utterance.transcript ?? '').split(/\s+/).filter(Boolean).length;
  if (words >= ACCIDENTAL_MAX_WORDS) return false;
  return words / (ms / 1000) < ACCIDENTAL_MAX_WORDS_PER_S;
}

/** Woorden die laten zien dat "nee …" echt een correctie is */
const CORRECTION_WORDS = new Set([
  'die',
  'dat',
  'het',
  'was',
  'is',
  'zijn',
  'waren',
  'niet',
  'geen',
  'plaats',
  'laatste',
  'vorige',
  'toch',
]);

/**
 * Alleen "nee" en een soortnaam ("Nee, waterhoen."): in de wind kan dat ook
 * "een waterhoen" zijn geweest. Jurian, 4 nov: daardoor werden de twee
 * krakeenden ervoor stil twee waterhoenders. Wie echt corrigeert, zegt meestal
 * meer ("nee, die laatste was een gaai", "nee, keep in plaats van vink").
 */
export function isBareNo(transcript: string | undefined): boolean {
  const words = (transcript ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words[0] !== 'nee' || words.length < 2 || words.length > 4) return false;
  return !words.slice(1).some((word) => CORRECTION_WORDS.has(word));
}

/** Velden die een onzekere waarneming bij een update niet zeker maken */
const NOT_A_CORRECTION: string[] = ['remarks', 'privateNote', 'spokenPlace'];

/**
 * Een plek die niet uit te rekenen is ("aan de overkant van de rivier") maakt
 * de waarneming onzeker, zodat hij bij het nalopen op de kaart gezet wordt.
 * Een reden van het model blijft staan.
 */
function placeUncertainty(
  fields: Partial<Pick<Observation, 'spokenPlace' | 'uncertain' | 'uncertainReason'>>,
): Pick<Observation, 'uncertain' | 'uncertainReason'> | undefined {
  const reason = fields.spokenPlace && placeReason(fields.spokenPlace);
  if (!reason) return undefined;
  const earlier = fields.uncertain ? fields.uncertainReason : undefined;
  if (earlier?.includes(reason)) return { uncertain: true, uncertainReason: earlier };
  return { uncertain: true, uncertainReason: earlier ? `${earlier}; ${reason}` : reason };
}

/** Zeldzaam (3) of zeer zeldzaam (4) bij waarneming.nl */
const RARE = 3;

/**
 * Twijfel erbij zetten, met de reden achter een eventuele eerdere reden.
 * Ontwikkelopties (devOptions.ts): zeldzame soort, voorbeeldzin.
 */
function withReason(
  fields: Pick<Observation, 'uncertain' | 'uncertainReason'>,
  reason: string | undefined,
): Pick<Observation, 'uncertain' | 'uncertainReason'> {
  if (!reason) return fields;
  const earlier = fields.uncertain ? fields.uncertainReason : undefined;
  if (earlier?.includes(reason)) return { uncertain: true, uncertainReason: earlier };
  return { uncertain: true, uncertainReason: earlier ? `${earlier}; ${reason}` : reason };
}

/**
 * De meeste fouten zijn verwisselingen met een andere echte vogelnaam. Kiest
 * de app een zeldzame soort, dan onzeker, zodat hij bij het nalopen bovenaan
 * staat (instelling, standaard aan).
 */
export function rareReason(speciesId: number): string | undefined {
  if (!preferenceOn('zeldzaamOnzeker') || rarityOf(speciesId) < RARE) return undefined;
  // Een dwaalgast is al onzeker, met zijn eigen reden (interpret.ts)
  if (isVagrant(speciesId)) return undefined;
  return `Zeldzame soort (${speciesName(speciesId)}): klopt het?`;
}

/** Transcript is letterlijk een voorbeeldzin uit de prompt (ontwikkeloptie) */
export function exampleReason(transcript: string | undefined): string | undefined {
  if (!devOptionOn('voorbeeldzinOnzeker') || !isPromptExample(transcript)) return undefined;
  return `Verstaan: "${transcript!.trim()}", een voorbeeldzin uit de spraakherkenning. Misschien niets verstaan`;
}

/** Voert de acties uit en geeft terug wat er veranderde. */
async function applyActions(utterance: Utterance, actions: Action[]): Promise<Change[]> {
  const changes: Change[] = [];
  let order = Date.now();
  // Waarschijnlijk per ongeluk opgenomen: alles wat eruit komt onzeker, zodat
  // het bij het nalopen opvalt
  const accidental: Partial<Observation> = isAccidental(utterance)
    ? {
        uncertain: true,
        uncertainReason: `Per ongeluk opgenomen? ${Math.round(utterance.audioDurationMs! / 1000)} s opname, verstaan: "${utterance.transcript}"`,
      }
    : {};

  for (const action of actions) {
    switch (action.type) {
      case 'add': {
        const observation: Observation = {
          id: crypto.randomUUID(),
          sessionId: utterance.sessionId,
          utteranceId: utterance.id,
          countingMethodId: DEFAULT_COUNTING_METHOD,
          activityId: DEFAULT_ACTIVITY,
          methodId: DEFAULT_METHOD,
          ...action.fields,
          uncertain: action.fields.uncertain ?? false,
          ...placeUncertainty(action.fields),
          ...accidental,
          observedAt: utterance.recordedAt,
          createdAt: order++,
          position: utterance.position,
          ...(action.fields.spokenPlace &&
            utterance.position &&
            placeFromSpeech(utterance.position, action.fields.spokenPlace)),
          area: utterance.area,
          status: 'draft',
        };
        Object.assign(
          observation,
          withReason(
            withReason(observation, rareReason(observation.speciesId)),
            exampleReason(utterance.transcript),
          ),
        );
        await db.observations.add(observation);
        changes.push({ type: 'add', observationId: observation.id });
        break;
      }

      case 'update': {
        const current = await db.observations.get(action.observationId);
        if (!current) break;
        const patch: Partial<Observation> = { ...action.fields };
        if (action.addCount) {
          patch.count = Math.max(1, (patch.count ?? current.count) + action.addCount);
        }
        // Een correctie zonder twijfel maakt een eerder onzekere waarneming
        // zeker; alleen een opmerking of notitie toevoegen niet
        const onlyRemarks =
          !action.addCount &&
          Object.keys(action.fields).every((key) => NOT_A_CORRECTION.includes(key));
        if (!onlyRemarks) {
          patch.uncertain ??= false;
          if (!patch.uncertain) patch.uncertainReason = undefined;
        }
        if (
          action.fields.speciesId !== undefined &&
          action.fields.speciesId !== current.speciesId &&
          isBareNo(utterance.transcript)
        ) {
          const reason = `Alleen "${utterance.transcript!.trim()}" verstaan; misschien "een …" (nieuwe waarneming). Was ${current.count} × ${speciesName(current.speciesId)}`;
          patch.uncertain = true;
          patch.uncertainReason = patch.uncertainReason
            ? `${patch.uncertainReason}; ${reason}`
            : reason;
        }
        // Kandidaten horen bij de twijfel over de soort: weg als de twijfel weg
        // is, of als er een andere soort gekozen is zonder nieuwe kandidaten
        if (
          current.candidates &&
          !action.fields.candidates &&
          (patch.uncertain === false ||
            (action.fields.speciesId !== undefined &&
              action.fields.speciesId !== current.speciesId))
        ) {
          patch.candidates = undefined;
        }
        if (action.fields.spokenPlace) {
          // Opnieuw vanaf de GPS-positie van de gebruiker, niet vanaf de vorige plek
          const gps =
            current.recordedPosition !== undefined
              ? (current.recordedPosition ?? undefined)
              : current.position;
          if (gps) Object.assign(patch, placeFromSpeech(gps, action.fields.spokenPlace));
          // De vorige plek is vervangen: zijn twijfel ("zet hem op de kaart") ook
          const merged = { ...current, ...patch };
          const stale = current.spokenPlace && placeReason(current.spokenPlace);
          if (stale && merged.uncertainReason?.includes(stale)) {
            // De reden bevat zelf "; ", dus vervangen in plaats van splitsen
            const rest = merged.uncertainReason
              .replace(`; ${stale}`, '')
              .replace(stale, '')
              .replace(/^; /, '');
            patch.uncertainReason = merged.uncertainReason = rest || undefined;
            if (!rest) patch.uncertain = merged.uncertain = false;
          }
          Object.assign(patch, placeUncertainty(merged));
        }
        Object.assign(patch, accidental);
        // Andere soort: is die zeldzaam (instelling)?
        if (
          action.fields.speciesId !== undefined &&
          action.fields.speciesId !== current.speciesId
        ) {
          const merged = { ...current, ...patch };
          Object.assign(patch, withReason(merged, rareReason(action.fields.speciesId)));
        }
        if (exampleReason(utterance.transcript)) {
          Object.assign(
            patch,
            withReason({ ...current, ...patch }, exampleReason(utterance.transcript)),
          );
        }

        const before = Object.fromEntries(
          Object.keys(patch).map((key) => [key, current[key as keyof Observation]]),
        ) as Partial<Observation>;
        await db.observations.update(current.id, patch);
        changes.push({ type: 'update', observationId: current.id, before });
        break;
      }

      case 'delete': {
        const current = await moveToBin(action.observationId, 'voice');
        if (!current) break;
        changes.push({ type: 'delete', observation: current });
        break;
      }

      case 'undo':
        await undoPrevious(utterance);
        break;

      case 'redo':
        await redoUndo(utterance);
        break;

      case 'dev_note':
        // Geen wijziging aan waarnemingen; de uitspraak wordt een dev note
        break;
    }
  }
  return changes;
}

/** Draait de meest recente, nog niet teruggedraaide uitspraak terug. */
async function undoPrevious(utterance: Utterance): Promise<void> {
  const previous = (await listUtterances(utterance.sessionId)).find(
    (u) =>
      u.id !== utterance.id &&
      u.recordedAt <= utterance.recordedAt &&
      u.status === 'done' &&
      !u.undone &&
      u.changes?.length,
  );
  if (!previous) return;

  const changes = await revert(previous.changes!);
  await db.utterances.update(previous.id, { undone: true });
  await db.utterances.update(utterance.id, { undid: { utteranceId: previous.id, changes } });
}

/**
 * Draait de meest recente undo terug ("toch niet ongedaan maken"). Daarna is
 * die undo zelf teruggedraaid, en kan een nieuwe undo de oorspronkelijke
 * uitspraak weer terugdraaien.
 */
async function redoUndo(utterance: Utterance): Promise<void> {
  const undo = (await listUtterances(utterance.sessionId)).find(
    (u) => u.id !== utterance.id && u.recordedAt <= utterance.recordedAt && !u.undone && u.undid,
  );
  if (!undo) return;

  await revert(undo.undid!.changes);
  await db.utterances.update(undo.undid!.utteranceId, { undone: false });
  await db.utterances.update(undo.id, { undone: true });
}

/**
 * Draait wijzigingen terug, de laatste eerst, en geeft terug wat dat zelf
 * veranderde (in dezelfde vorm, zodat ook dat weer terug kan).
 */
async function revert(changes: Change[]): Promise<Change[]> {
  const reverted: Change[] = [];
  for (const change of [...changes].reverse()) {
    if (change.type === 'add') {
      const observation = await moveToBin(change.observationId, 'undo');
      if (observation) reverted.push({ type: 'delete', observation });
    }
    if (change.type === 'update') {
      const current = await db.observations.get(change.observationId);
      if (!current) continue;
      const before = Object.fromEntries(
        Object.keys(change.before).map((key) => [key, current[key as keyof Observation]]),
      ) as Partial<Observation>;
      await db.observations.update(change.observationId, change.before);
      reverted.push({ type: 'update', observationId: change.observationId, before });
    }
    if (change.type === 'delete') {
      await db.observations.put(change.observation);
      await db.deletedObservations.delete(change.observation.id);
      reverted.push({ type: 'add', observationId: change.observation.id });
    }
  }
  return reverted;
}

/** Aantal soorten, zonder verzamelsoorten ("Eend onbekend") */
export function countSpecies(observations: Observation[]): number {
  return new Set(
    observations
      .filter((obs) => getSpecies(obs.speciesId)?.type !== 'M')
      .map((obs) => obs.speciesId),
  ).size;
}
