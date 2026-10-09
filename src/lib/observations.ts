import {
  db,
  type Change,
  type Observation,
  type Position,
  type ProcessingMetrics,
  type Utterance,
} from './db';
import { ApiError } from './api';
import { MODEL, interpret, promptVersion, type Action, type Interpretation } from './interpret';
import { currentPosition } from './location.svelte';
import { APP_VERSION, logEvent, wasHiddenSince } from './log';
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
  const id = crypto.randomUUID();
  // Positie opvragen op het moment van de uitspraak, maar niet erop wachten:
  // de uitspraak wordt meteen opgeslagen en verwerkt.
  const position = currentPosition();
  await db.utterances.add({
    id,
    sessionId,
    recordedAt: Date.now(),
    transcript: text.trim(),
    status: 'pending',
  });
  processQueue();
  attachPosition(id, position);
}

/**
 * Koppelt de positie aan de uitspraak zodra die bekend is. Is de uitspraak
 * dan al verwerkt, dan krijgen de waarnemingen eruit de positie alsnog.
 */
async function attachPosition(utteranceId: string, pending: Promise<Position | undefined>) {
  const position = await pending;
  if (!position) return;
  await db.transaction('rw', db.utterances, db.observations, async () => {
    await db.utterances.update(utteranceId, { position });
    await db.observations
      .where('utteranceId')
      .equals(utteranceId)
      .filter((obs) => !obs.position)
      .modify({ position });
  });
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
  // Dev notes gaan niet naar het model: snel, gratis en altijd goed herkend
  if (devNoteText(utterance.transcript ?? '') !== undefined) {
    await db.utterances.update(utterance.id, { status: 'done', kind: 'dev_note', result: 'note' });
    return;
  }

  const startedAt = Date.now();
  const attempts = (utterance.attempts ?? 0) + 1;
  const ids = { sessionId: utterance.sessionId, utteranceId: utterance.id };
  await db.utterances.update(utterance.id, { status: 'processing', attempts });

  let interpretation: Interpretation;
  try {
    const recent = await listObservations(utterance.sessionId);
    interpretation = await interpret(utterance.transcript ?? '', recent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // In de log, want een volgende poging overschrijft de fout bij de uitspraak
    logEvent(
      'attempt_failed',
      {
        attempt: attempts,
        error: message,
        status: error instanceof ApiError ? error.status : undefined,
        waitedMs: startedAt - utterance.recordedAt,
        durationMs: Date.now() - startedAt,
        wasHidden: wasHiddenSince(utterance.recordedAt),
        online: navigator.onLine,
      },
      ids,
    );
    await db.utterances.update(utterance.id, { status: 'failed', error: message });
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

  await db.transaction('rw', db.observations, db.utterances, async () => {
    // Opnieuw ophalen: de positie kan intussen binnengekomen zijn
    const latest = (await db.utterances.get(utterance.id)) ?? utterance;
    const changes = await applyActions(latest, interpretation.actions);
    const touched = await db.observations.bulkGet(
      changes.flatMap((c) => (c.type === 'delete' ? [] : [c.observationId])),
    );
    const uncertain = touched.some((obs) => obs?.uncertain);

    await db.utterances.update(utterance.id, {
      status: 'done',
      llmOutput: interpretation.response,
      metrics,
      changes,
      result: interpretation.actions.length === 0 ? 'ignored' : uncertain ? 'uncertain' : 'saved',
      error: interpretation.rejected.length ? interpretation.rejected.join('; ') : undefined,
    });
  });
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
        // Een correctie zonder twijfel maakt een eerder onzekere waarneming zeker
        patch.uncertain ??= false;
        if (!patch.uncertain) patch.uncertainReason = undefined;

        const before = Object.fromEntries(
          Object.keys(patch).map((key) => [key, current[key as keyof Observation]]),
        ) as Partial<Observation>;
        await db.observations.update(current.id, patch);
        changes.push({ type: 'update', observationId: current.id, before });
        break;
      }

      case 'delete': {
        const current = await db.observations.get(action.observationId);
        if (!current) break;
        await db.observations.delete(current.id);
        changes.push({ type: 'delete', observation: current });
        break;
      }

      case 'undo':
        await undoPrevious(utterance);
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
    if (change.type === 'add') await db.observations.delete(change.observationId);
    if (change.type === 'update') await db.observations.update(change.observationId, change.before);
    if (change.type === 'delete') await db.observations.put(change.observation);
  }
  await db.utterances.update(previous.id, { undone: true });
}
