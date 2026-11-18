import { db, type Position, type PositionLookup } from './db';
import { attachArea } from './area';
import { gps } from './location.svelte';
import { logEvent } from './log';
import { placeFromSpeech } from './spokenPlace';

// De plek bij een uitspraak. De uitspraak wacht niet op de GPS (queue.ts slaat
// hem meteen op); de plek gaat erbij zodra hij bekend is, ook als de
// waarnemingen er al uit gehaald zijn.

/**
 * Koppelt de positie aan de uitspraak zodra die bekend is. Is de uitspraak
 * dan al verwerkt, dan krijgen de waarnemingen eruit de positie alsnog.
 * Daarna het gebied van waarneming.nl, op dezelfde manier.
 */
export async function attachPosition(utteranceId: string, pending: Promise<PositionLookup>) {
  const { position, ...positionLookup } = await pending;
  if (!position) {
    // Intussen al een latere plek gekregen (`positionLater`): die laten staan
    const saved = await db.utterances.get(utteranceId);
    if (saved?.position) return;
    await db.utterances.update(utteranceId, { positionLookup });
    // Kwam de eerste meting net binnen terwijl deze opvraag opgaf: meteen gebruiken
    const latest = gps.latest && { ...gps.latest };
    if (latest && saved) await positionLater(latest, saved.sessionId);
    return;
  }
  await setPosition(utteranceId, position, positionLookup);
}

/** Zo ver terug krijgen uitspraken zonder plek de eerste latere meting nog. */
export const LATER_MAX_MS = 10 * 60_000;
/** Wandeltempo in m/s: zo ver kun je verder zijn als de plek later komt. */
const WALKING_SPEED = 1.4;

/**
 * De GPS heeft (weer) een plek, na uitspraken waarbij hij er geen had: de
 * GPS zonder fix, bv. in vliegtuigmodus of binnen, waar de eerste meting
 * minuten kan duren. Die uitspraken (tot `LATER_MAX_MS` terug) krijgen deze
 * plek alsnog. In een trektelling sta je stil, dus dan klopt hij; anders
 * groeit de nauwkeurigheid met hoe ver je in die tijd gelopen kunt hebben.
 * Alleen uitspraken van deze sessie: een vorige sessie kan vlak daarvoor
 * gestopt zijn, kilometers verderop (met de auto naar de volgende plek).
 */
export async function positionLater(fix: Position, sessionId: string): Promise<void> {
  const unplaced = await db.utterances
    .where('recordedAt')
    .between(fix.fixedAt - LATER_MAX_MS, fix.fixedAt, true, true)
    .filter((u) => u.sessionId === sessionId && !u.position && u.positionLookup?.source === 'none')
    .toArray();
  for (const u of unplaced) {
    const laterMs = fix.fixedAt - u.recordedAt;
    const accuracy = u.trektel
      ? fix.accuracy
      : Math.round(fix.accuracy + (WALKING_SPEED * laterMs) / 1000);
    await setPosition(
      u.id,
      { ...fix, accuracy },
      { source: 'later', waitMs: laterMs, error: u.positionLookup?.error },
    );
  }
  if (unplaced.length)
    logEvent('position_later', { count: unplaced.length, accuracy: fix.accuracy });
}

/** Positie bij de uitspraak en de waarnemingen eruit, daarna het gebied. */
async function setPosition(
  utteranceId: string,
  position: Position,
  positionLookup: Omit<PositionLookup, 'position'>,
) {
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
