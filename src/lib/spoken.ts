// Gesproken bevestiging na het verwerken van een uitspraak, in de oortjes
// (SprekenPlugin.java, docs/roadmap-android.md stap 2). Nog een
// ontwikkeloptie: alleen de eigenaar (devOptions.ts). De tril blijft gewoon;
// dit zegt erbij *wat* er is vastgelegd, zodat je in het veld kunt verbeteren
// zonder te kijken.

import { db, type Observation, type Utterance } from './db';
import { devOptionOn } from './devOptions';
import { logEvent } from './log';
import { speakNative, speechSupported } from './native';
import { isComputable, type Direction } from './spokenPlace';
import { activityName, codesFor, speciesName } from './vocab';

/** Meer dan zoveel waarnemingen: alleen het aantal noemen */
const MAX_NAMED = 2;

type Spoken = Pick<Utterance, 'status' | 'result' | 'changes' | 'undid'>;

const DIRECTION_WORDS: Record<Direction, string> = {
  N: 'noord',
  NO: 'noordoost',
  O: 'oost',
  ZO: 'zuidoost',
  Z: 'zuid',
  ZW: 'zuidwest',
  W: 'west',
  NW: 'noordwest',
};

/** De gezegde plek, kort: "30 meter zuid", anders in de woorden van de gebruiker */
function describePlace(place: NonNullable<Observation['spokenPlace']>): string {
  if (!isComputable(place)) return place.text;
  const m = place.distanceM!;
  const distance =
    m < 1000 ? `${m} meter` : `${String(Math.round(m / 100) / 10).replace('.', ',')} kilometer`;
  return `${distance} ${DIRECTION_WORDS[place.direction!]}`;
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
  const parts = [speciesName(obs.speciesId).toLowerCase(), String(obs.count)];
  if (obs.activityId !== undefined && obs.activityId !== codesFor(obs.speciesId).defaultActivity) {
    const activity = activityName(obs.speciesId, obs.activityId);
    // "baltsend / zingend": geen schuine streep voorlezen
    if (activity) parts.push(activity.toLowerCase().replaceAll(' / ', ' of '));
  }
  if (obs.spokenPlace) parts.push(describePlace(obs.spokenPlace));
  if (obs.uncertain) parts.push('onzeker');
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
  if (utterance.status === 'failed') return 'Niet gelukt';
  if (utterance.result === 'ignored') return 'Niet begrepen';
  if (utterance.result === 'note') return 'Feedback bewaard';
  if (utterance.undid) return 'Ongedaan gemaakt';

  const said: string[] = [];
  let count = 0;
  let uncertainCount = 0;
  for (const change of utterance.changes ?? []) {
    if (change.type === 'delete') {
      said.push(`weg: ${speciesName(change.observation.speciesId).toLowerCase()}`);
      count++;
      continue;
    }
    const obs = current.get(change.observationId);
    if (!obs) continue;
    count++;
    if (obs.uncertain) uncertainCount++;
    said.push(change.type === 'update' ? `aangepast: ${describe(obs)}` : describe(obs));
  }
  const flagged = utterance.result === 'uncertain';
  if (count === 0) return flagged ? 'Opgeslagen, onzeker' : 'Opgeslagen';
  if (count > MAX_NAMED) {
    return uncertainCount > 0
      ? `${count} waarnemingen, ${uncertainCount} onzeker`
      : `${count} waarnemingen${flagged ? '. Onzeker' : ''}`;
  }
  const capital = (part: string) => part.charAt(0).toUpperCase() + part.slice(1);
  const sentence = said.map(capital).join('. ');
  // Onzeker zonder dat één waarneming het is (zou niet moeten): dan toch zeggen
  return flagged && uncertainCount === 0 ? `${sentence}. Onzeker` : sentence;
}

/** Na het trillen: zeggen wat er is vastgelegd, als de ontwikkeloptie aan staat */
export async function confirmAloud(utterance: Utterance): Promise<void> {
  if (!speechSupported || !devOptionOn('gesproken')) return;
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
