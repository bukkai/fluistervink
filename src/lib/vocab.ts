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
  name: string;
  /** Engelse naam, voor de bulkimport van waarneming.nl */
  en?: string;
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

export function getSpecies(id: number): Species | undefined {
  return speciesById.get(id);
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
// een wandeling uitspreekt. Het model mag alleen hieruit kiezen.
const FIELD_ACTIVITIES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 25, 26, 30, 31, 77, 2016];
const FIELD_METHODS = [48, 49, 51];
const FIELD_LIFE_STAGES = [2, 3, 4, 5, 14, 15, 1101, 1102];

function pick(codes: Code[], ids: number[]): Code[] {
  return ids.map((id) => codes.find((c) => c.id === id)!);
}

export const activities = pick(attributes.activity, FIELD_ACTIVITIES);
export const methods = pick(attributes.method, FIELD_METHODS);
export const lifeStages = pick(attributes.life_stage, FIELD_LIFE_STAGES);

/**
 * Telmethode staat niet in de attributenlijst; codes uit de API-documentatie,
 * Engelse namen uit het voorbeeldbestand van de bulkimport.
 */
export const countingMethods: Code[] = [
  { id: 2, name: 'exact aantal', en: 'real count' },
  { id: 6, name: 'schatting', en: 'estimated' },
  { id: 3, name: 'gezien, niet geteld', en: 'seen not counted' },
];

export const DEFAULT_ACTIVITY = 1; // ter plaatse
export const DEFAULT_METHOD = 48; // gezien
export const DEFAULT_COUNTING_METHOD = 2; // exact aantal

export function codeName(codes: Code[], id: number | undefined): string | undefined {
  return codes.find((c) => c.id === id)?.name;
}
