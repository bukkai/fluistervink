// Gesproken bevestiging na het verwerken van een uitspraak, in de oortjes
// (SprekenPlugin.java, docs/roadmap-android.md stap 2). Een proef bij
// Instellingen, standaard uit (preferences.ts). De tril blijft gewoon;
// dit zegt erbij *wat* er is vastgelegd, zodat je in het veld kunt verbeteren
// zonder te kijken.

import { LOCALE, t } from './i18n';
import { db, type Observation, type Utterance } from './db';
import { logEvent } from './log';
import { preferenceOn } from './preferences';
import { speakNative, speechSupported } from './native';
import { isComputable } from './spokenPlace';
import { activityLabel, codesFor, speciesLabel } from './vocab';

/** Meer dan zoveel waarnemingen: alleen het aantal noemen */
const MAX_NAMED = 2;

type Spoken = Pick<Utterance, 'status' | 'result' | 'changes' | 'undid'>;

/** De gezegde plek, kort: "30 meter zuid", anders in de woorden van de gebruiker */
function describePlace(place: NonNullable<Observation['spokenPlace']>): string {
  if (!isComputable(place)) return place.text;
  const m = place.distanceM!;
  const distance =
    m < 1000
      ? t('spoken.meters', { m })
      : t('spoken.kilometers', {
          km: (Math.round(m / 100) / 10).toLocaleString(LOCALE),
        });
  return `${distance} ${t(`spoken.direction.${place.direction!}`)}`;
}

type Described = Pick<
  Observation,
  'speciesId' | 'count' | 'activityId' | 'spokenPlace' | 'uncertain'
>;

/**
 * Kort wat de waarneming is: "houtduif, 6, overvliegend" (TTS leest het
 * getal), met de gezegde plek en "onzeker" bij díe waarneming, niet pas aan
 * het eind van alles.
 */
function describe(obs: Described): string {
  const parts = [speciesLabel(obs.speciesId).toLowerCase(), String(obs.count)];
  if (obs.activityId !== undefined && obs.activityId !== codesFor(obs.speciesId).defaultActivity) {
    const activity = activityLabel(obs.speciesId, obs.activityId);
    // "baltsend / zingend": geen schuine streep voorlezen
    if (activity) parts.push(activity.toLowerCase().replaceAll(' / ', t('spoken.or')));
  }
  if (obs.spokenPlace) parts.push(describePlace(obs.spokenPlace));
  if (obs.uncertain) parts.push(t('spoken.uncertain'));
  return parts.join(', ');
}

/**
 * Wat de app zegt bij een verwerkte uitspraak. `current`: de waarnemingen
 * zoals ze nu zijn, voor toevoegingen en wijzigingen. Undefined = niets zeggen.
 */
export function confirmationText(
  utterance: Spoken,
  current: Map<string, Observation>,
): string | undefined {
  if (utterance.status === 'failed') return t('spoken.failed');
  if (utterance.result === 'ignored') return t('spoken.ignored');
  if (utterance.result === 'note') return t('spoken.note');
  if (utterance.undid) return t('spoken.undone');

  const said: string[] = [];
  let count = 0;
  let uncertainCount = 0;
  for (const change of utterance.changes ?? []) {
    if (change.type === 'delete') {
      said.push(
        t('spoken.deleted', {
          species: speciesLabel(change.observation.speciesId).toLowerCase(),
        }),
      );
      count++;
      continue;
    }
    const obs = current.get(change.observationId);
    if (!obs) continue;
    count++;
    if (obs.uncertain) uncertainCount++;
    said.push(
      change.type === 'update' ? t('spoken.updated', { what: describe(obs) }) : describe(obs),
    );
  }
  const flagged = utterance.result === 'uncertain';
  if (count === 0) return flagged ? t('spoken.savedUncertain') : t('spoken.saved');
  if (count > MAX_NAMED) {
    if (uncertainCount > 0)
      return t('spoken.manyUncertain', { n: count, uncertain: uncertainCount });
    return flagged ? t('spoken.manyFlagged', { n: count }) : t('spoken.many', { n: count });
  }
  const capital = (part: string) => part.charAt(0).toUpperCase() + part.slice(1);
  const sentence = said.map(capital).join('. ');
  // Onzeker zonder dat één waarneming het is (zou niet moeten): dan toch zeggen
  return flagged && uncertainCount === 0 ? t('spoken.flagged', { sentence }) : sentence;
}

/** Na het inhalen (lang op bereik gewacht): alleen hoeveel er verwerkt is */
export function catchUpText(done: number, failed: number): string {
  const parts = [
    done ? t('spoken.caughtUp', { n: done }) : '',
    failed ? t('spoken.caughtUpFailed', { n: failed }) : '',
  ];
  const text = parts.filter(Boolean).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Na de ene tril van het inhalen, als de instelling aan staat */
export async function confirmCatchUp(done: number, failed: number): Promise<void> {
  if (!speechSupported || !preferenceOn('gesproken')) return;
  const { gesproken, reden } = await speakNative(catchUpText(done, failed));
  if (!gesproken && reden !== 'geen oortjes') logEvent('speak_failed', { reden });
}

/** Na het trillen: zeggen wat er is vastgelegd, als de instelling aan staat */
export async function confirmAloud(utterance: Utterance): Promise<void> {
  if (!speechSupported || !preferenceOn('gesproken')) return;
  const ids = (utterance.changes ?? []).flatMap((c) =>
    c.type === 'delete' ? [] : [c.observationId],
  );
  const observations = await db.observations.bulkGet(ids);
  const current = new Map(observations.filter((o): o is Observation => !!o).map((o) => [o.id, o]));
  const text = confirmationText(utterance, current);
  if (!text) return;
  const { gesproken, reden } = await speakNative(text);
  if (!gesproken && reden !== 'geen oortjes') {
    logEvent(
      'speak_failed',
      { reden },
      { sessionId: utterance.sessionId, utteranceId: utterance.id },
    );
  }
}
