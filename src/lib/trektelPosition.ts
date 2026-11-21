import { db, type Position, type PositionLookup } from './db';
import { attachArea } from './area';
import { currentPosition } from './location.svelte';
import { logEvent } from './log';
import { placeFromSpeech } from './spokenPlace';

// De plek van trektelstukken. In een trektelling sta je stil, dus elk stuk
// krijgt de beste meting van deze telling, ook als die van vóór het stuk is.
// Zonder dit vroeg een stuk zijn plek op op het moment dat de webcode het
// begin hoorde. Met het scherm uit ligt de webcode na een minuut stil
// (screenOff.svelte.ts, `page_frozen`); dan was dat pas bij het ontgrendelen,
// met een grove eerste meting (19 nov: ±200 m, terwijl er een van 18 m was).
// Een latere, nauwkeurigere meting verbetert de stukken van deze telling,
// tot de telling stopt (daarna loop je misschien weg).

/** Zo nauwkeurig is een meting goed genoeg om een oudere, betere te vervangen */
export const GOOD_ACCURACY_M = 30;
/** Een meting van zo kort vóór de start telt al mee (je staat al op je plek) */
export const SEED_MAX_MS = 2 * 60_000;

let telling:
  | {
      sessionId: string;
      startedAt: number;
      best?: Position;
      /** Gestopt: de plek geldt nog voor het laatste stuk, maar verbetert niet meer */
      ended: boolean;
    }
  | undefined;

/** Een trektelling begint; `latest` is de laatste meting van de GPS. */
export function startTrektelPosition(sessionId: string, startedAt: number, latest?: Position) {
  const seed = latest && startedAt - latest.fixedAt <= SEED_MAX_MS ? latest : undefined;
  telling = { sessionId, startedAt, best: seed, ended: false };
}

/** De telling stopte: geen verbeteringen meer. */
export function endTrektelPosition() {
  if (telling) telling.ended = true;
}

/** Sessie weg: alles vergeten. */
export function resetTrektelPosition() {
  telling = undefined;
}

/** De plek van deze telling, als die er is. */
export function trektelLookup(sessionId: string): PositionLookup | undefined {
  if (!telling?.best || telling.sessionId !== sessionId) return undefined;
  return { source: 'trektel', position: { ...telling.best }, waitMs: 0 };
}

/**
 * De plek voor een stuk dat nu begint: die van de telling, anders opvragen
 * (GPS nog zonder meting: dan `none`, en de eerste meting komt er later bij).
 */
export function chunkPosition(sessionId: string): Promise<PositionLookup> {
  const lookup = trektelLookup(sessionId);
  return lookup ? Promise.resolve(lookup) : currentPosition();
}

/**
 * Een nieuwe meting van de GPS. Is hij beter dan wat de telling had (of
 * nieuwer en goed genoeg), dan wordt het de plek van de telling, en krijgen
 * stukken met een slechtere plek (of zonder) deze.
 */
export async function noteTrektelFix(fix: Position): Promise<void> {
  const current = telling;
  if (!current || current.ended) return;
  const { best } = current;
  if (best && fix.fixedAt <= best.fixedAt) return;
  if (best && fix.accuracy >= best.accuracy && fix.accuracy > GOOD_ACCURACY_M) return;
  current.best = { ...fix };
  await improveChunks(fix, current.sessionId, current.startedAt);
}

/** Stukken van deze telling met een slechtere plek of zonder plek: deze meting */
async function improveChunks(fix: Position, sessionId: string, since: number) {
  const chunks = await db.utterances
    .where('recordedAt')
    .aboveOrEqual(since)
    .filter(
      (u) =>
        u.sessionId === sessionId &&
        u.trektel === true &&
        // Nog aan het opvragen: die krijgt zijn eigen plek (attachPosition)
        u.positionLookup !== undefined &&
        (!u.position || u.position.accuracy > fix.accuracy),
    )
    .toArray();
  if (!chunks.length) return;
  for (const u of chunks) {
    const placed = await db.transaction('rw', db.utterances, db.observations, async () => {
      // Intussen een betere plek gekregen: een volgende meting liep sneller
      // door de stukken (het gebied opzoeken hieronder wacht op het netwerk)
      const now = await db.utterances.get(u.id);
      if (!now || (now.position && now.position.accuracy <= fix.accuracy)) return undefined;
      await db.utterances.update(u.id, {
        position: { ...fix },
        positionLookup: { source: 'trektel', waitMs: fix.fixedAt - u.recordedAt },
      });
      await db.observations
        .where('utteranceId')
        .equals(u.id)
        .modify((obs) => {
          // Plek genoemd in de uitspraak ("500 m zuid"): opnieuw uitrekenen
          if (obs.placedByVoice && obs.spokenPlace)
            Object.assign(obs, placeFromSpeech(fix, obs.spokenPlace));
          // Met de hand gezet: blijft staan, de GPS-plek om naar terug te gaan wordt beter
          else if (obs.recordedPosition !== undefined) obs.recordedPosition = { ...fix };
          else if (obs.spokenPlace) Object.assign(obs, placeFromSpeech(fix, obs.spokenPlace));
          else obs.position = { ...fix };
        });
      return { first: !now.position };
    });
    // Het gebied alleen bij een eerste plek: een betere meting ligt op dezelfde plek
    if (placed?.first) await attachArea(u.id, fix);
  }
  logEvent('trektel_position', {
    count: chunks.length,
    accuracy: fix.accuracy,
    unplaced: chunks.filter((u) => !u.position).length,
  });
}
