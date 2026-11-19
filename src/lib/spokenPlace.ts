import { t, type Language } from './i18n';
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
  return t('reason.place', { text: spoken.text });
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
  // Object.hasOwn: "constructor" staat ook "in" een object
  if (Object.hasOwn(FRACTIONS, w)) return FRACTIONS[w];
  if (Object.hasOwn(UNITS, w)) return UNITS[w];
  if (Object.hasOwn(TENS, w)) return TENS[w];
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
  if (compound && Object.hasOwn(UNITS, compound[1]) && UNITS[compound[1]] < 10) {
    return UNITS[compound[1]] + TENS[compound[2]];
  }
  return undefined;
}

/**
 * Afstand en windrichting uit de omschrijving zelf ("honderd meter ten
 * zuidwesten van hier"). Het model vult place_distance_m soms niet in, ook als
 * de afstand er letterlijk staat; dan haalt de app hem hier alsnog uit.
 * `language`: de taal van de uitspraak ("two hundred yards south-west").
 */
export function parsePlaceText(
  text: string,
  language: Language = 'nl',
): Pick<SpokenPlace, 'distanceM' | 'direction'> {
  if (language === 'en') return parseEnglishPlaceText(text);
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

/** Windrichting in het Engels: de codes zijn Nederlands (O is oost) */
const ENGLISH_DIRECTIONS: Record<Direction, string> = {
  N: 'N',
  NO: 'NE',
  O: 'E',
  ZO: 'SE',
  Z: 'S',
  ZW: 'SW',
  W: 'W',
  NW: 'NW',
};

/** Korte omschrijving als het model alleen afstand en richting gaf: "500 m Z", in het Engels "500 m S" */
export function describePlace(
  distanceM?: number,
  direction?: Direction,
  language: Language = 'nl',
): string {
  const km = distanceM === undefined ? '' : (distanceM / 1000).toString();
  const distance =
    distanceM === undefined
      ? undefined
      : distanceM < 1000
        ? `${distanceM} m`
        : `${language === 'en' ? km : km.replace('.', ',')} km`;
  const shown = direction && language === 'en' ? ENGLISH_DIRECTIONS[direction] : direction;
  return [distance, shown].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Engels (ontwikkeloptie "English", docs/plan-engels.md): "200 metres south",
// "half a mile north-east", "three hundred yards to the west"

const ENGLISH_UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}; // prettier-ignore

/** Meters per eenheid; yards en miles, want zo schat een Brit of Amerikaan */
const ENGLISH_LENGTHS: [RegExp, number][] = [
  [/^(km|kilomet(er|re)s?)$/, 1000],
  [/^(mi|miles?)$/, 1609.344],
  [/^(yd|yds|yards?)$/, 0.9144],
  [/^(m|met(er|re)s?)$/, 1],
];

/**
 * Engels getal in cijfers of woorden: "200", "1.5", "two hundred and fifty",
 * "a hundred", "half a", "one and a half", "twenty-five". Undefined als er een
 * woord tussen staat dat geen getal is.
 */
export function parseEnglishNumber(words: string[]): number | undefined {
  const tokens = words.flatMap((w) => w.toLowerCase().split('-')).filter((w) => w && w !== 'and');
  if (!tokens.length) return undefined;
  if (tokens.length === 1 && /^\d+(\.\d+)?$/.test(tokens[0].replace(/,/g, ''))) {
    return Number(tokens[0].replace(/,/g, ''));
  }
  let total = 0;
  let current = 0;
  let half = false;
  for (const [i, token] of tokens.entries()) {
    if (token === 'half') half = true;
    else if (token === 'a' || token === 'an') {
      // "a hundred", "a mile"; "half a" en "one and a half" tellen bij half
      if (tokens[i + 1] !== 'half' && tokens[i - 1] !== 'half') current += 1;
    } else if (Object.hasOwn(ENGLISH_UNITS, token)) current += ENGLISH_UNITS[token];
    else if (token === 'hundred') current = (current || 1) * 100;
    else if (token === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
    } else return undefined;
  }
  const value = total + current + (half ? 0.5 : 0);
  // "half a mile": de "a" telt niet als 1
  return value > 0 ? value : undefined;
}

function parseEnglishPlaceText(text: string): Pick<SpokenPlace, 'distanceM' | 'direction'> {
  const result: Pick<SpokenPlace, 'distanceM' | 'direction'> = {};
  const distance =
    /(?:^|\s)(?:([\d.,]+)\s*|((?:[a-z-]+\s+){0,4}))(km|kilomet(?:er|re)s?|mi|miles?|yds?|yards?|m|met(?:er|re)s?)(?![a-z])/i.exec(
      text,
    );
  if (distance) {
    const words = distance[1] ? [distance[1]] : distance[2].trim().split(/\s+/);
    // Het langste stuk vóór de eenheid dat een getal is: "about two hundred" → 200
    let value: number | undefined;
    for (let start = 0; start < words.length && value === undefined; start++) {
      value = parseEnglishNumber(words.slice(start));
    }
    const unit = distance[3].toLowerCase();
    const factor = ENGLISH_LENGTHS.find(([pattern]) => pattern.test(unit))?.[1] ?? 1;
    const meters = value === undefined ? undefined : Math.round(value * factor);
    if (meters !== undefined && meters >= 1 && meters <= MAX_DISTANCE_M) result.distanceM = meters;
  }
  const direction =
    /(?:^|[^a-z])(?:(north|south)(?:[- ]?(east|west))?|(east|west))(?:ern|erly|wards?)?(?![a-z])/i.exec(
      text,
    );
  if (direction) {
    const letter: Record<string, string> = { north: 'N', south: 'Z', east: 'O', west: 'W' };
    const part = (word?: string) => (word ? letter[word.toLowerCase()] : '');
    const code = (part(direction[1]) + part(direction[2] ?? direction[3])) as Direction;
    if (Object.hasOwn(DIRECTIONS, code)) result.direction = code;
  }
  return result;
}
