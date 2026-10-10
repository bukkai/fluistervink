import {
  db,
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
import { MODEL, interpret, promptVersion, type Action, type Interpretation } from './interpret';
import { currentPosition } from './location.svelte';
import { APP_VERSION, logEvent, wasHiddenSince } from './log';
import type { Recording } from './recorder.svelte';
import { TRANSCRIBE_MODEL, transcribe, transcribePromptVersion } from './transcribe';
import { DEFAULT_ACTIVITY, DEFAULT_COUNTING_METHOD, DEFAULT_METHOD } from './vocab';

// Local-first verwerking: elke uitspraak wordt eerst opgeslagen (status
// `pending`) en daarna één voor één, op volgorde, door het model gehaald.
// Normaal is de wachtrij direct leeg; bij een fout blijft de uitspraak bewaard
// en kan hij opnieuw.

/** Waarnemingen van een wandeling, nieuwste eerst. */
export async function listObservations(sessionId: string): Promise<Observation[]> {
  const all = await db.observations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.observedAt - a.observedAt || b.createdAt - a.createdAt);
}

/** Uitspraken van een wandeling, nieuwste eerst. */
export async function listUtterances(sessionId: string): Promise<Utterance[]> {
  const all = await db.utterances.where('sessionId').equals(sessionId).sortBy('recordedAt');
  return all.reverse();
}

/** Slaat een getypte uitspraak op en zet hem in de wachtrij. */
export async function submitText(sessionId: string, text: string): Promise<void> {
  // Positie opvragen op het moment van de uitspraak, maar niet erop wachten:
  // de uitspraak wordt meteen opgeslagen en verwerkt.
  await submit(
    { sessionId, recordedAt: Date.now(), transcript: text.trim() },
    currentPosition(),
  );
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
): Promise<void> {
  await submit(
    {
      sessionId,
      recordedAt: recording.startedAt,
      audio: recording.audio,
      audioDurationMs: recording.durationMs,
    },
    lookup,
  );
}

async function submit(
  fields: Pick<Utterance, 'sessionId' | 'recordedAt' | 'transcript' | 'audio' | 'audioDurationMs'>,
  lookup: Promise<PositionLookup>,
): Promise<void> {
  const id = crypto.randomUUID();
  await db.utterances.add({ id, ...fields, status: 'pending' });
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
      .filter((obs) => !obs.position)
      .modify({ position });
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

/**
 * Waarneming wel of niet meenemen in de export. Telt niet als correctie
 * (geen `editedAt`), want de waarneming zelf verandert niet.
 */
export async function setSkipExport(id: string, skip: boolean): Promise<void> {
  await db.observations.update(id, { skipExport: skip || undefined });
}

/** Verwijderde waarnemingen van een wandeling, laatst verwijderd eerst. */
export async function listDeleted(sessionId: string): Promise<DeletedObservation[]> {
  const all = await db.deletedObservations.where('sessionId').equals(sessionId).toArray();
  return all.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Verwijdert een waarneming met de hand; hij gaat naar de prullenbak. */
export async function deleteObservation(id: string): Promise<void> {
  await db.transaction('rw', db.observations, db.deletedObservations, () =>
    moveToBin(id, 'hand'),
  );
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

export async function retry(utteranceId: string): Promise<void> {
  await db.utterances.update(utteranceId, { status: 'pending', error: undefined });
  processQueue();
}

let running = false;

/**
 * Verwerkt alle wachtende uitspraken op volgorde. Wordt na elke nieuwe
 * uitspraak aangeroepen; een tweede aanroep terwijl hij loopt doet niets.
 */
export async function processQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    // Uitspraken die bleven hangen (app afgesloten tijdens verwerken) opnieuw
    const stuck = await db.utterances.where('status').equals('processing').toArray();
    for (const u of stuck)
      logEvent('requeued', undefined, { sessionId: u.sessionId, utteranceId: u.id });
    await db.utterances.where('status').equals('processing').modify({ status: 'pending' });

    while (true) {
      const [next] = await db.utterances.where('status').equals('pending').sortBy('recordedAt');
      if (!next) break;
      await processUtterance(next);
      const processed = await db.utterances.get(next.id);
      if (processed) vibrate(utteranceFeedback(processed));
    }
  } finally {
    running = false;
  }
}

/**
 * "Dev note, …" aan het begin van een uitspraak, ook zoals spraakherkenning
 * het vaak verstaat ("def note", "devnoot", "Dev. Note:"). Geeft de tekst
 * erna terug, of undefined als het geen dev note is.
 */
export function devNoteText(transcript: string): string | undefined {
  const match = /^\s*(dev|def|deaf)\W*(notes?|noot|nood)\b[\s,:;.!-]*/i.exec(transcript);
  return match ? transcript.slice(match[0].length).trim() : undefined;
}

async function processUtterance(utterance: Utterance): Promise<void> {
  const startedAt = Date.now();
  const attempts = (utterance.attempts ?? 0) + 1;
  const ids = { sessionId: utterance.sessionId, utteranceId: utterance.id };
  await db.utterances.update(utterance.id, { status: 'processing', attempts });

  let step: 'transcribe' | 'interpret' = 'transcribe';
  let interpretation: Interpretation;
  try {
    // Opname: eerst spraak naar tekst. Na een fout bij de interpretatie blijft
    // het transcript bewaard, zodat "Opnieuw" alleen die stap herhaalt.
    if (utterance.transcript === undefined && utterance.audio) {
      utterance = await transcribeUtterance(utterance);
    }
    const transcript = utterance.transcript ?? '';

    // Dev notes gaan niet naar het model: snel, gratis en altijd goed herkend
    if (devNoteText(transcript) !== undefined) {
      await db.utterances.update(utterance.id, { status: 'done', kind: 'dev_note', result: 'note' });
      return;
    }
    // Niets verstaan (wind, per ongeluk ingedrukt): niet naar het model
    if (!transcript) {
      await db.utterances.update(utterance.id, { status: 'done', result: 'ignored' });
      return;
    }

    step = 'interpret';
    const recent = await listObservations(utterance.sessionId);
    interpretation = await interpret(transcript, recent);
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
    await db.utterances.update(utterance.id, { status: 'failed', error: prefix + message });
    return;
  }

  const metrics: ProcessingMetrics = {
    appVersion: APP_VERSION,
    model: MODEL,
    promptVersion: await promptVersion,
    context: interpretation.context,
    startedAt,
    finishedAt: Date.now(),
    ...interpretation.timing,
    wasHidden: wasHiddenSince(utterance.recordedAt),
    online: navigator.onLine,
  };

  await db.transaction('rw', db.observations, db.deletedObservations, db.utterances, async () => {
    // Opnieuw ophalen: de positie kan intussen binnengekomen zijn
    const latest = (await db.utterances.get(utterance.id)) ?? utterance;
    const changes = await applyActions(latest, interpretation.actions);
    const touched = await db.observations.bulkGet(
      changes.flatMap((c) => (c.type === 'delete' ? [] : [c.observationId])),
    );
    const uncertain = touched.some((obs) => obs?.uncertain);
    const devNote = interpretation.actions.some((a) => a.type === 'dev_note');

    await db.utterances.update(utterance.id, {
      status: 'done',
      llmOutput: interpretation.response,
      metrics,
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

/** Zet de opname om in tekst en slaat het transcript op. */
async function transcribeUtterance(utterance: Utterance): Promise<Utterance> {
  const { text, timing } = await transcribe(utterance.audio!);
  const changes = {
    transcript: text,
    transcription: {
      model: TRANSCRIBE_MODEL,
      promptVersion: await transcribePromptVersion,
      ...timing,
    },
  };
  await db.utterances.update(utterance.id, changes);
  return { ...utterance, ...changes };
}

/** Voert de acties uit en geeft terug wat er veranderde. */
async function applyActions(utterance: Utterance, actions: Action[]): Promise<Change[]> {
  const changes: Change[] = [];
  let order = Date.now();

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
          observedAt: utterance.recordedAt,
          createdAt: order++,
          position: utterance.position,
          area: utterance.area,
          status: 'draft',
        };
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
          Object.keys(action.fields).every((key) => key === 'remarks' || key === 'privateNote');
        if (!onlyRemarks) {
          patch.uncertain ??= false;
          if (!patch.uncertain) patch.uncertainReason = undefined;
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

  for (const change of [...previous.changes!].reverse()) {
    if (change.type === 'add') await moveToBin(change.observationId, 'undo');
    if (change.type === 'update') await db.observations.update(change.observationId, change.before);
    if (change.type === 'delete') {
      await db.observations.put(change.observation);
      await db.deletedObservations.delete(change.observation.id);
    }
  }
  await db.utterances.update(previous.id, { undone: true });
}
