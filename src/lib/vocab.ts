import attributes from '../../data/attributen-vogels.json';
import speciesList from '../../data/soorten-nl.json';

// Vaste lijsten met waarneming.nl-ID's: soorten, gedrag, methode, kleed en
// telmethode. Zie docs/waarneming-nl.md.

export interface Species {
  id: number;
  name: string;
  scientific: string;
  /** S = soort, M = verzamelsoort ("Eend onbekend") */
  type: 'S' | 'M';
  rarity: number;
}

export interface Code {
  id: number;
  name: string;
}

export const species = speciesList as Species[];
const speciesById = new Map(species.map((s) => [s.id, s]));

export function getSpecies(id: number): Species | undefined {
  return speciesById.get(id);
}

// Uit de volledige lijsten van waarneming.nl alleen de codes die je tijdens
// een wandeling uitspreekt. Het model mag alleen hieruit kiezen.
const FIELD_ACTIVITIES = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25, 26, 30, 31, 77];
const FIELD_METHODS = [48, 49, 51];
const FIELD_LIFE_STAGES = [2, 3, 4, 5, 14, 15, 1101, 1102];

function pick(codes: Code[], ids: number[]): Code[] {
  return ids.map((id) => codes.find((c) => c.id === id)!);
}

export const activities = pick(attributes.activity, FIELD_ACTIVITIES);
export const methods = pick(attributes.method, FIELD_METHODS);
export const lifeStages = pick(attributes.life_stage, FIELD_LIFE_STAGES);

/** Telmethode staat niet in de attributenlijst; codes uit de API-documentatie. */
export const countingMethods: Code[] = [
  { id: 2, name: 'exact aantal' },
  { id: 6, name: 'schatting' },
  { id: 3, name: 'gezien, niet geteld' },
];

export const DEFAULT_ACTIVITY = 1; // ter plaatse
export const DEFAULT_METHOD = 48; // gezien
export const DEFAULT_COUNTING_METHOD = 2; // exact aantal

export function codeName(codes: Code[], id: number | undefined): string | undefined {
  return codes.find((c) => c.id === id)?.name;
}
