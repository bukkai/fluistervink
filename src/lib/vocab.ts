import attributes from '../../data/attributen-vogels.json';
import aliasList from '../../data/bijnamen.json';
import allSpeciesList from '../../data/soorten-nl-alle.json';
import speciesList from '../../data/soorten-nl.json';

// Vaste lijsten met waarneming.nl-ID's: soorten, gedrag, methode, kleed en
// telmethode. Zie docs/waarneming-nl.md.

export interface Species {
  id: number;
  name: string;
  scientific: string;
  /**
   * S = soort, M = verzamelsoort ("Eend onbekend"), Y = soort die de bron apart
   * groepeert (Bonte Kraai), F = gedomesticeerde vorm (Stadsduif, Parkgans),
   * I = ondersoort (Vale Pijlstormvogel)
   */
  type: 'S' | 'M' | 'Y' | 'F' | 'I';
  rarity: number;
}

export interface Code {
  id: number;
  /** Nederlandse naam, zoals op waarneming.nl (ook in de export) */
  name: string;
}

/** Soorten in de prompt: het model kiest alleen hieruit */
export const species = speciesList as Species[];
const promptSpeciesIds = new Set(species.map((s) => s.id));

/**
 * Alle Nederlandse soorten van waarneming.nl, ook zeer zeldzame dwaalgasten.
 * Voor het bewerkformulier, zodat je zo'n waarneming thuis goed kunt zetten.
 */
export const allSpecies = allSpeciesList as Species[];
const speciesById = new Map(allSpecies.map((s) => [s.id, s]));

/**
 * Soort-ID's die waarneming.nl heeft vervangen. Oude waarnemingen houden het
 * oude ID, maar tonen en exporteren de nieuwe soort. Bonte Kraai: sinds nov
 * 2026 een ondersoort van de Zwarte Kraai (Corvus corone cornix).
 */
const REPLACED: Record<number, number> = { 67: 255102 };

export function getSpecies(id: number): Species | undefined {
  return speciesById.get(REPLACED[id] ?? id);
}

/** Naam om te tonen; "soort 123" als het ID niet (meer) in de lijst staat */
export function speciesName(id: number): string {
  return getSpecies(id)?.name ?? `soort ${id}`;
}

// Ook op wetenschappelijke naam: zet het model die in species_name, dan klopt
// de soort nog steeds. Geen soort heeft als wetenschappelijke naam een
// Nederlandse naam van een andere soort.
const promptSpeciesByName = new Map(
  species.flatMap((s) => [
    [s.scientific.toLowerCase(), s],
    [s.name.toLowerCase(), s],
  ]),
);

/**
 * Soort uit de lijst in de prompt, op Nederlandse of wetenschappelijke naam
 * (hoofdletters maken niet uit)
 */
export function findPromptSpecies(name: string): Species | undefined {
  return promptSpeciesByName.get(name.trim().toLowerCase());
}

/** Mag het model deze soort kiezen? */
export function isPromptSpecies(id: number): boolean {
  return promptSpeciesIds.has(id);
}

/**
 * Bijnamen en afkortingen uit vogelaarsjargon ("tova", "robotap", "KBV"),
 * zie data/bijnamen.json. `naam` staat er alleen voor de leesbaarheid.
 */
export interface Alias {
  soort: number;
  naam: string;
  bijnamen: string[];
}

export const aliases = (aliasList as Alias[]).filter((a) => {
  if (isPromptSpecies(a.soort)) return true;
  console.warn(`bijnamen.json: onbekende soort-ID ${a.soort} (${a.naam})`);
  return false;
});

// Uit de volledige lijsten van waarneming.nl alleen de codes die je tijdens
// een sessie uitspreekt. Het model mag alleen hieruit kiezen: meer opties
// in de prompt geeft meer kans op een verkeerde keuze.
const FIELD_ACTIVITIES = [
  1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 25, 26, 30, 31, 77, 2016, 78, 3051, 3116, 3119,
  3121, 3144,
];
const FIELD_METHODS = [48, 49, 51, 588];
const FIELD_LIFE_STAGES = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 62, 72, 1175, 1009, 1101, 1102,
];

function pick(codes: Code[], ids: number[]): Code[] {
  return ids.map((id) => codes.find((c) => c.id === id)!);
}

/** Alle codes van waarneming.nl: voor het formulier, de weergave en de export */
export const allActivities: Code[] = attributes.activity;
export const allMethods: Code[] = attributes.method;
export const allLifeStages: Code[] = attributes.life_stage;

/** Codes in de prompt */
export const activities = pick(allActivities, FIELD_ACTIVITIES);
export const methods = pick(allMethods, FIELD_METHODS);
export const lifeStages = pick(allLifeStages, FIELD_LIFE_STAGES);

/**
 * Telmethode staat niet in de attributenlijst; codes en namen uit
 * /api/v1/lookups/ van waarneming.nl (nagekeken 6 nov).
 */
export const countingMethods: Code[] = [
  { id: 2, name: 'exact aantal' },
  { id: 6, name: 'schatting' },
  { id: 3, name: 'gezien niet geteld' },
];

export const DEFAULT_ACTIVITY = 1; // ter plaatse
export const DEFAULT_METHOD = 48; // gezien
export const DEFAULT_COUNTING_METHOD = 2; // exact aantal

export function codeName(codes: Code[], id: number | undefined): string | undefined {
  return codes.find((c) => c.id === id)?.name;
}
