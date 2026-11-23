import { ApiError } from './api';
import { language, t } from './i18n';
import { interpret, type Action } from './interpret';
import { logEvent } from './log';
import { transcribe } from './transcribe';
import { activityLabel, groupLabel, lifeStageLabel, methodLabel, speciesLabel } from './vocab';

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
    ? candidates.map(speciesLabel).join(t('tryout.or'))
    : speciesLabel(speciesId);
  const group = groupLabel(speciesId);
  const details = [
    activityLabel(speciesId, activityId),
    methodLabel(speciesId, methodId),
    lifeStageLabel(speciesId, lifeStageId),
    sex === 'male' ? t('log.male') : sex === 'female' ? t('log.female') : undefined,
  ].filter(Boolean);
  return {
    text: [`${count} × ${name}${group ? ` (${group})` : ''}`, ...details].join(', '),
    uncertain: !!action.fields.uncertain || !!candidates?.length,
  };
}

/** Spraakherkenning en model, in de taal van de app, zonder iets op te slaan. */
export async function tryUtterance(audio: Blob, groups: boolean): Promise<TryResult> {
  const startedAt = Date.now();
  try {
    const { text: transcript } = await transcribe(audio, { groups, language, kind: 'proberen' });
    let lines: TryLine[] = [];
    if (transcript) {
      // Geen eerdere waarnemingen: verwijzingen ("nog drie") kunnen hier niet
      const { actions } = await interpret(transcript, [], {
        groups,
        language,
        kind: 'proberen',
      });
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
    return t('tryout.audioLimit');
  }
  if (error instanceof ApiError && error.code === 'message_limit') {
    return t('tryout.messageLimit');
  }
  return navigator.onLine ? t('tryout.failed') : t('tryout.offline');
}
