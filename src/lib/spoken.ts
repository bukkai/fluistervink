// Gesproken bevestiging na het verwerken van een uitspraak, in de oortjes
// (SprekenPlugin.java, docs/roadmap-android.md stap 2). Nog een
// ontwikkeloptie: alleen de eigenaar (devOptions.ts). De tril blijft gewoon;
// dit zegt erbij *wat* er is vastgelegd, zodat je in het veld kunt verbeteren
// zonder te kijken.

import { db, type Observation, type Utterance } from './db';
import { devOptionOn } from './devOptions';
import { logEvent } from './log';
import { speakNative, speechSupported } from './native';
import { allActivities, codeName, DEFAULT_ACTIVITY, speciesName } from './vocab';

/** Meer dan zoveel waarnemingen: alleen het aantal noemen */
const MAX_NAMED = 2;

type Spoken = Pick<Utterance, 'status' | 'result' | 'changes' | 'undid'>;

/** Kort wat de waarneming is: "houtduif, 6, overvliegend" (TTS leest het getal) */
function describe(obs: Pick<Observation, 'speciesId' | 'count' | 'activityId'>): string {
  const parts = [speciesName(obs.speciesId).toLowerCase(), String(obs.count)];
  if (obs.activityId !== undefined && obs.activityId !== DEFAULT_ACTIVITY) {
    const activity = codeName(allActivities, obs.activityId);
    // "baltsend / zingend": geen schuine streep voorlezen
    if (activity) parts.push(activity.toLowerCase().replaceAll(' / ', ' of '));
  }
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
  let uncertain = utterance.result === 'uncertain';
  let count = 0;
  for (const change of utterance.changes ?? []) {
    if (change.type === 'delete') {
      said.push(`weg: ${speciesName(change.observation.speciesId).toLowerCase()}`);
      count++;
      continue;
    }
    const obs = current.get(change.observationId);
    if (!obs) continue;
    count++;
    if (obs.uncertain) uncertain = true;
    said.push(change.type === 'update' ? `aangepast: ${describe(obs)}` : describe(obs));
  }
  if (count === 0) return uncertain ? 'Opgeslagen, onzeker' : 'Opgeslagen';
  const capital = (part: string) => part.charAt(0).toUpperCase() + part.slice(1);
  const sentence = count > MAX_NAMED ? `${count} waarnemingen` : said.map(capital).join('. ');
  return uncertain ? `${sentence}. Onzeker` : sentence;
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
