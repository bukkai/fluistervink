import type { Observation, Position, SpokenPlace } from './db';

// Plek van de vogel zoals de gebruiker hem noemt: "buizerd overvliegend, 500 m
// zuid van hier", "blauwe reiger aan de overkant van de rivier". Met afstand én
// windrichting rekent de app de plek uit; anders blijft de plek die van de
// gebruiker, met een grotere onzekerheid, en zet de gebruiker hem thuis op de
// kaart (de waarneming wordt onzeker). De kaart lezen doet de app niet.

/** Windrichtingen zoals het model ze teruggeeft, in graden vanaf het noorden */
export const DIRECTIONS: Record<Direction, number> = {
  N: 0,
  NO: 45,
  O: 90,
  ZO: 135,
  Z: 180,
  ZW: 225,
  W: 270,
  NW: 315,
};

export type Direction = NonNullable<SpokenPlace['direction']>;

/** Langer dan dit is geen schatting meer van wat je ziet of hoort */
export const MAX_DISTANCE_M = 20_000;

/** Fout in een geschatte afstand: zo'n 30% (over water of open veld vaak meer) */
const DISTANCE_ERROR = 0.3;

/** Nauwkeurigheid als er alleen een omschrijving is ("aan de overkant van de rivier") */
export const UNKNOWN_PLACE_ACCURACY = 200;

/** Positie verschoven over een afstand in een richting; op deze afstanden is plat rekenen genoeg */
export function offsetPosition(from: Position, distanceM: number, bearing: number): Position {
  const rad = (bearing * Math.PI) / 180;
  const north = distanceM * Math.cos(rad);
  const east = distanceM * Math.sin(rad);
  const metersPerDegree = 111_320;
  return {
    ...from,
    lat: from.lat + north / metersPerDegree,
    lon: from.lon + east / (metersPerDegree * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** De plek is uit te rekenen (afstand én windrichting) */
export function isComputable(spoken: SpokenPlace): boolean {
  return spoken.distanceM !== undefined && spoken.direction !== undefined;
}

export type VoicePlace = Pick<Observation, 'position' | 'recordedPosition' | 'placedByVoice'>;

/**
 * De plek van de vogel volgens de uitspraak, vanaf de GPS-positie van de
 * gebruiker. Die blijft bewaard in `recordedPosition`, zoals bij een met de
 * hand gezette plek, zodat "Terug naar de opgenomen plek" werkt.
 */
export function placeFromSpeech(gps: Position, spoken: SpokenPlace): VoicePlace {
  const { distanceM, direction } = spoken;
  let position: Position;
  if (distanceM !== undefined && direction !== undefined) {
    position = offsetPosition(gps, distanceM, DIRECTIONS[direction]);
    position.accuracy = Math.round(Math.hypot(gps.accuracy, DISTANCE_ERROR * distanceM));
  } else if (distanceM !== undefined) {
    // Richting onbekend: de vogel zit ergens in een cirkel om de gebruiker
    position = { ...gps, accuracy: Math.round(Math.hypot(gps.accuracy, distanceM)) };
  } else {
    position = { ...gps, accuracy: Math.max(gps.accuracy, UNKNOWN_PLACE_ACCURACY) };
  }
  return { position, recordedPosition: gps, placedByVoice: true };
}

/** Waarom de waarneming onzeker wordt, als de plek niet uit te rekenen is */
export function placeReason(spoken: SpokenPlace): string | undefined {
  if (isComputable(spoken)) return undefined;
  return `Plek gezegd: "${spoken.text}"; zet hem op de kaart`;
}

/** Korte omschrijving als het model alleen afstand en richting gaf: "500 m Z" */
export function describePlace(distanceM?: number, direction?: Direction): string {
  const distance =
    distanceM === undefined
      ? undefined
      : distanceM < 1000
        ? `${distanceM} m`
        : `${(distanceM / 1000).toString().replace('.', ',')} km`;
  return [distance, direction].filter(Boolean).join(' ');
}
