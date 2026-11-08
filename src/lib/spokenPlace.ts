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

/** Plek van een waarneming en de bewaarde GPS-plek (met de hand of volgens de uitspraak gezet) */
export type Place = Pick<Observation, 'position' | 'recordedPosition' | 'placedByVoice'>;

/**
 * De plek van de vogel volgens de uitspraak, vanaf de GPS-positie van de
 * gebruiker. Die blijft bewaard in `recordedPosition`, zoals bij een met de
 * hand gezette plek, zodat "Terug naar de opgenomen plek" werkt.
 */
export function placeFromSpeech(gps: Position, spoken: SpokenPlace): Place {
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

const UNITS: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9,
  tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14, vijftien: 15, zestien: 16,
  zeventien: 17, achttien: 18, negentien: 19,
}; // prettier-ignore
const TENS: Record<string, number> = {
  twintig: 20, dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80,
  negentig: 90,
}; // prettier-ignore
const FRACTIONS: Record<string, number> = {
  half: 0.5,
  halve: 0.5,
  anderhalf: 1.5,
  anderhalve: 1.5,
};

/** Getal in cijfers of in woorden: "200", "1,5", "tweehonderdvijftig", "anderhalve" */
export function parseNumber(word: string): number | undefined {
  const w = word.toLowerCase();
  if (/^\d+([.,]\d+)?$/.test(w)) return Number(w.replace(',', '.'));
  if (w in FRACTIONS) return FRACTIONS[w];
  if (w in UNITS) return UNITS[w];
  if (w in TENS) return TENS[w];
  for (const [name, factor] of [
    ['duizend', 1000],
    ['honderd', 100],
  ] as const) {
    const at = w.indexOf(name);
    if (at < 0) continue;
    const left = w.slice(0, at);
    const right = w.slice(at + name.length).replace(/^en/, '');
    const times = left ? parseNumber(left) : 1;
    const plus = right ? parseNumber(right) : 0;
    if (times === undefined || plus === undefined) return undefined;
    return times * factor + plus;
  }
  const compound =
    /^(.+?)[eë]n(twintig|dertig|veertig|vijftig|zestig|zeventig|tachtig|negentig)$/.exec(w);
  if (compound && compound[1] in UNITS && UNITS[compound[1]] < 10) {
    return UNITS[compound[1]] + TENS[compound[2]];
  }
  return undefined;
}

/**
 * Afstand en windrichting uit de omschrijving zelf ("honderd meter ten
 * zuidwesten van hier"). Het model vult place_distance_m soms niet in, ook als
 * de afstand er letterlijk staat; dan haalt de app hem hier alsnog uit.
 */
export function parsePlaceText(text: string): Pick<SpokenPlace, 'distanceM' | 'direction'> {
  const result: Pick<SpokenPlace, 'distanceM' | 'direction'> = {};
  const distance =
    /(?:^|\s)(?:([\d.,]+)\s*|([a-zéë]+(?:\s+[a-zéë]+)?)\s+)(km|kilometer|m|meter)(?![a-z])/i.exec(
      text,
    );
  if (distance) {
    const words = (distance[1] ?? distance[2]).split(/\s+/);
    const value = parseNumber(words.join('')) ?? parseNumber(words[words.length - 1]);
    const factor = /^k/i.test(distance[3]) ? 1000 : 1;
    const meters = value === undefined ? undefined : Math.round(value * factor);
    if (meters !== undefined && meters >= 1 && meters <= MAX_DISTANCE_M) result.distanceM = meters;
  }
  const direction =
    /(?:^|[^a-z])(?:(noord|zuid)[- ]?(oost|west)?|(oost|west))(?:en|elijk|elijke)?(?![a-z])/i.exec(
      text,
    );
  if (direction) {
    const letter = (part?: string) => (part ? part[0].toUpperCase() : '');
    const code = (letter(direction[1]) + letter(direction[2] ?? direction[3])) as Direction;
    if (Object.hasOwn(DIRECTIONS, code)) result.direction = code;
  }
  return result;
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
