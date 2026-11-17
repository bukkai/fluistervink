import { ApiError } from './api';
import { interpret, type Action } from './interpret';
import { logEvent } from './log';
import { transcribe } from './transcribe';
import { activityName, groupLabel, lifeStageName, methodName, speciesName } from './vocab';

// "Probeer het eens" in het welkom: thuis één zin inspreken en zien wat
// Fluistervink ervan maakt. Dezelfde spraakherkenning en hetzelfde model als
// in een sessie, maar er wordt niets bewaard: geen sessie, geen uitspraak,
// geen opname. Alleen een regel in het gebeurtenissenlog (zonder de tekst).

export interface TryLine {
  /** "3 × Merel, zingend" */
  text: string;
  uncertain: boolean;
}

export interface TryResult {
  /** Wat de spraakherkenning verstond; leeg als er niets verstaan is */
  transcript: string;
  /** De waarnemingen die het zouden worden; leeg = geen waarneming gehoord */
  lines: TryLine[];
}

/** Eén nieuwe waarneming in gewone woorden, zoals in het overzicht */
export function describeAdd(action: Extract<Action, { type: 'add' }>): TryLine {
  const { speciesId, count, activityId, methodId, lifeStageId, sex, candidates } = action.fields;
  const name = candidates?.length
    ? candidates.map(speciesName).join(' of ')
    : speciesName(speciesId);
  const group = groupLabel(speciesId);
  const details = [
    activityName(speciesId, activityId),
    methodName(speciesId, methodId),
    lifeStageName(speciesId, lifeStageId),
    sex === 'male' ? 'man' : sex === 'female' ? 'vrouw' : undefined,
  ].filter(Boolean);
  return {
    text: [`${count} × ${name}${group ? ` (${group})` : ''}`, ...details].join(', '),
    uncertain: !!action.fields.uncertain || !!candidates?.length,
  };
}

/** Spraakherkenning en model, zonder iets op te slaan. */
export async function tryUtterance(audio: Blob, groups: boolean): Promise<TryResult> {
  const startedAt = Date.now();
  try {
    const { text: transcript } = await transcribe(audio, { groups });
    let lines: TryLine[] = [];
    if (transcript) {
      // Geen eerdere waarnemingen: verwijzingen ("nog drie") kunnen hier niet
      const { actions } = await interpret(transcript, [], { groups });
      lines = actions.flatMap((action) => (action.type === 'add' ? [describeAdd(action)] : []));
    }
    logEvent('tryout', { ms: Date.now() - startedAt, observations: lines.length });
    return { transcript, lines };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('tryout_failed', { ms: Date.now() - startedAt, error: message });
    throw error;
  }
}

/** Foutmelding in gewone taal */
export function tryErrorText(error: unknown): string {
  if (error instanceof ApiError && error.code === 'audio_limit') {
    return 'Voor vandaag is het maximum aan spraak bereikt. Morgen kan het weer.';
  }
  return navigator.onLine
    ? 'Dat lukte even niet. Probeer het nog eens.'
    : 'Je hebt nu geen verbinding. Probeer het als je weer online bent.';
}
