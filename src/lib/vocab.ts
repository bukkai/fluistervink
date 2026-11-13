import dragonflyAttributes from '../../data/attributen-libellen.json';
import butterflyAttributes from '../../data/attributen-dagvlinders.json';
import herpAttributes from '../../data/attributen-reptielen-amfibieen.json';
import attributes from '../../data/attributen-vogels.json';
import mammalAttributes from '../../data/attributen-zoogdieren.json';
import aliasList from '../../data/bijnamen.json';
import allSpeciesList from '../../data/soorten-nl-alle.json';
import speciesList from '../../data/soorten-nl.json';

// Vaste lijsten met waarneming.nl-ID's: soorten, gedrag, methode, kleed en
// telmethode. Zie docs/waarneming-nl.md. Naast vogels ook zoogdieren,
// reptielen en amfibieën, dagvlinders en libellen (docs/plan-soortgroepen.md);
// die zijn nog niet in de app te kiezen.

/**
 * Soortgroep van waarneming.nl: 1 vogels, 2 zoogdieren, 3 reptielen en
 * amfibieën, 4 dagvlinders, 5 libellen
 */
export type GroupId = 1 | 2 | 3 | 4 | 5;
export const BIRDS: GroupId = 1;

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
  group: GroupId;
}

export interface Code {
  id: number;
  /** Nederlandse naam, zoals op waarneming.nl (ook in de export) */
  name: string;
}

/** Soorten in de prompt van alle groepen; voorlopig gaan alleen de vogels naar het model */
const promptSpeciesAllGroups = speciesList as Species[];

/** Vogels in de prompt: het model kiest alleen hieruit */
export const species = promptSpeciesAllGroups.filter((s) => s.group === BIRDS);
const promptSpeciesIds = new Set(species.map((s) => s.id));

/** Soorten van een andere groep die in de prompt kunnen (nog niet gebruikt) */
export function promptSpeciesOf(group: GroupId): Species[] {
  return promptSpeciesAllGroups.filter((s) => s.group === group);
}

/** Alle soorten van alle groepen, ook zeer zeldzame: om een ID op te zoeken */
const allSpeciesAllGroups = allSpeciesList as Species[];
const speciesById = new Map(allSpeciesAllGroups.map((s) => [s.id, s]));

/**
 * Alle Nederlandse vogels van waarneming.nl, ook zeer zeldzame dwaalgasten.
 * Voor het bewerkformulier, zodat je zo'n waarneming thuis goed kunt zetten.
 */
export const allSpecies = allSpeciesAllGroups.filter((s) => s.group === BIRDS);

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
// Nederlandse naam van een andere soort, ook niet tussen de groepen.
const byName = (list: Species[]) =>
  new Map(
    list.flatMap((s) => [
      [s.scientific.toLowerCase(), s],
      [s.name.toLowerCase(), s],
    ]),
  );
const promptSpeciesByName = byName(species);
const promptSpeciesAllGroupsByName = byName(promptSpeciesAllGroups);
const promptSpeciesAllGroupsIds = new Set(promptSpeciesAllGroups.map((s) => s.id));

/**
 * Soort uit de lijst in de prompt, op Nederlandse of wetenschappelijke naam
 * (hoofdletters maken niet uit). `withGroups`: ook de andere soortgroepen
 * (ontwikkeloptie 'soortgroepen').
 */
export function findPromptSpecies(name: string, withGroups = false): Species | undefined {
  const key = name.trim().toLowerCase();
  return (withGroups ? promptSpeciesAllGroupsByName : promptSpeciesByName).get(key);
}

/** Mag het model deze soort kiezen? */
export function isPromptSpecies(id: number, withGroups = false): boolean {
  return (withGroups ? promptSpeciesAllGroupsIds : promptSpeciesIds).has(id);
}

// ---------------------------------------------------------------------------
// Dwaalgasten: zeer zeldzame soorten die niet in de prompt staan. Noemt de
// gebruiker er een, dan geeft het model de naam door (unlisted_species) en
// zoekt de app hem hier op. Geen uitheemse ontsnapte kooivogels (zeldzaamheid
// 0 in de bron): die zijn geen dwaalgast.

/** Kleine letters, zonder accenten, spaties, streepjes en apostroffen */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const VAGRANT_RARITY = 4;
const vagrants = allSpecies.filter(
  (s) => s.rarity === VAGRANT_RARITY && s.type === 'S' && !promptSpeciesIds.has(s.id),
);
const vagrantIds = new Set(vagrants.map((s) => s.id));
const keysOf = (s: Species) => [normalizeName(s.name), normalizeName(s.scientific)];
const vagrantKeys = vagrants.flatMap((s) => keysOf(s).map((key) => ({ key, s })));
const promptKeys = species.flatMap(keysOf);

/** Is dit een dwaalgast (zeer zeldzaam, niet in de prompt)? */
export function isVagrant(id: number): boolean {
  return vagrantIds.has(id);
}

/** Aantal letters dat mag verschillen: spraakherkenning schrijft namen soms net anders */
function allowedTypos(length: number): number {
  return length >= 10 ? 2 : length >= 6 ? 1 : 0;
}

/** Levenshtein-afstand, met een bovengrens: verder dan `max` geeft max + 1 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    if (Math.min(...current) > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Dwaalgast bij een gezegde naam (Nederlands of wetenschappelijk), met een
 * paar letters speling. Liever geen soort dan een verkeerde: niets als twee
 * dwaalgasten even goed passen, of als een soort uit de prompt minstens zo
 * goed past ("roodborsttapuit" is geen Roodkeeltapuit).
 */
export function findVagrant(name: string): Species | undefined {
  const said = normalizeName(name);
  const max = allowedTypos(said.length);
  if (!said) return undefined;
  let best: Species | undefined;
  let bestDistance = max + 1;
  let tie = false;
  for (const { key, s } of vagrantKeys) {
    const d = editDistance(said, key, max);
    if (d < bestDistance) {
      best = s;
      bestDistance = d;
      tie = false;
    } else if (d === bestDistance && best && s.id !== best.id) {
      tie = true;
    }
  }
  if (!best || tie) return undefined;
  if (promptKeys.some((key) => editDistance(said, key, bestDistance) <= bestDistance)) {
    return undefined;
  }
  return best;
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

const allAliases = (aliasList as Alias[]).filter((a) => {
  if (isPromptSpecies(a.soort, true)) return true;
  console.warn(`bijnamen.json: onbekende soort-ID ${a.soort} (${a.naam})`);
  return false;
});

/** Bijnamen van vogels */
export const aliases = allAliases.filter((a) => groupOf(a.soort) === BIRDS);

/** Bijnamen van een andere soortgroep ("egel", "eekhoorn") */
export function aliasesOf(group: GroupId): Alias[] {
  return allAliases.filter((a) => groupOf(a.soort) === group);
}

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
  return ids.map((id) => {
    const code = codes.find((c) => c.id === id);
    if (!code) throw new Error(`Code ${id} staat niet in de lijst van waarneming.nl`);
    return code;
  });
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

// ---------------------------------------------------------------------------
// Codes per soortgroep. Elke groep heeft bij waarneming.nl eigen ID's voor
// gedrag, methode en kleed: "ter plaatse" is 1 bij vogels, 15 bij zoogdieren.
// Een waarneming bewaart de ID's van de groep van haar soort.

export interface GroupCodes {
  /** Alle codes van waarneming.nl: voor het formulier, de weergave en de export */
  allActivities: Code[];
  allMethods: Code[];
  allLifeStages: Code[];
  /** Codes in de prompt: wat je tijdens het vogelen zegt */
  activities: Code[];
  methods: Code[];
  lifeStages: Code[];
  /** Ter plaatse */
  defaultActivity: number;
  /** Gezien */
  defaultMethod: number;
}

export interface Group {
  id: GroupId;
  /** Zoals op waarneming.nl */
  name: string;
  codes: GroupCodes;
}

interface Attributes {
  activity: Code[];
  method: Code[];
  life_stage: Code[];
}

function groupCodes(
  source: Attributes,
  field: { activities: number[]; methods: number[]; lifeStages: number[] },
  defaults: { activity: number; method: number },
): GroupCodes {
  return {
    allActivities: source.activity,
    allMethods: source.method,
    allLifeStages: source.life_stage,
    activities: pick(source.activity, field.activities),
    methods: pick(source.method, field.methods),
    lifeStages: pick(source.life_stage, field.lifeStages),
    defaultActivity: pick(source.activity, [defaults.activity])[0].id,
    defaultMethod: pick(source.method, [defaults.method])[0].id,
  };
}

// De korte lijsten voor de prompt, per groep. Uit de volledige lijst alleen
// wat je in het veld ziet of zegt; geen vallen, collecties of DNA.
const GROUPS: Record<GroupId, Group> = {
  1: {
    id: 1,
    name: 'Vogels',
    codes: {
      allActivities,
      allMethods,
      allLifeStages,
      activities,
      methods,
      lifeStages,
      defaultActivity: DEFAULT_ACTIVITY,
      defaultMethod: DEFAULT_METHOD,
    },
  },
  2: {
    id: 2,
    name: 'Zoogdieren',
    codes: groupCodes(
      mammalAttributes,
      {
        // ter plaatse, foeragerend, overvliegend (vleermuizen), roepend, vluchtend,
        // zwemmend, dood, slachtoffer verkeer, ziek/gewond, (nabij) nest / burcht
        activities: [15, 16, 72, 71, 2022, 2029, 18, 67, 2021, 2023],
        // gezien, gehoord, gezien en gehoord, batdetector, uitwerpselen, prenten,
        // vraatsporen, andere sporen, op geluidsrecorder
        methods: [123, 124, 126, 119, 591, 592, 593, 595, 597],
        // adult, juveniel, subadult
        lifeStages: [20, 27, 1002],
      },
      { activity: 15, method: 123 },
    ),
  },
  3: {
    id: 3,
    name: 'Reptielen en amfibieën',
    codes: groupCodes(
      herpAttributes,
      {
        // ter plaatse, foeragerend, roepend, parend, eileggend, zonnend, dood,
        // slachtoffer verkeer
        activities: [19, 3180, 64, 3198, 3271, 3155, 21, 2005],
        // gezien, gehoord, gezien en gehoord
        methods: [148, 149, 151],
        // adult, juveniel, subadult, larve, ei, vervellingshuidje
        lifeStages: [21, 71, 73, 74, 24, 1094],
      },
      { activity: 19, method: 148 },
    ),
  },
  4: {
    id: 4,
    name: 'Dagvlinders',
    codes: groupCodes(
      butterflyAttributes,
      {
        // ter plaatse, foeragerend, in copula, eileggend, zonnend, overvliegend,
        // langstrekkend noord, zuid, oost, west, dood
        activities: [20, 3181, 33, 34, 3200, 3123, 73, 74, 75, 76, 23],
        // gezien
        methods: [173],
        // imago, rups, pop, ei
        lifeStages: [29, 23, 26, 66],
      },
      { activity: 20, method: 173 },
    ),
  },
  5: {
    id: 5,
    name: 'Libellen',
    codes: groupCodes(
      dragonflyAttributes,
      {
        // ter plaatse, foeragerend, in copula, tandem, eileggend, territoriaal,
        // vervellend (uitsluipend), overvliegend, dood
        activities: [45, 3183, 47, 3272, 48, 3235, 50, 3127, 46],
        // gezien
        methods: [198],
        // imago, larve/nimf, imago niet uitgekleurd, larvenhuidje
        lifeStages: [37, 41, 75, 131],
      },
      { activity: 45, method: 198 },
    ),
  },
};

export const groups: Group[] = Object.values(GROUPS);

export function getGroup(id: GroupId): Group {
  return GROUPS[id];
}

/** Groep van een soort; vogels als het ID onbekend is (oude of vervangen soort) */
export function groupOf(speciesId: number): GroupId {
  return getSpecies(speciesId)?.group ?? BIRDS;
}

/** Gedrag, methode en kleed van de groep van deze soort */
export function codesFor(speciesId: number): GroupCodes {
  return GROUPS[groupOf(speciesId)].codes;
}

/** Naam van het gedrag, in de codes van de groep van de soort */
export function activityName(speciesId: number, id: number | undefined): string | undefined {
  return codeName(codesFor(speciesId).allActivities, id);
}

/** Naam van de methode, in de codes van de groep van de soort */
export function methodName(speciesId: number, id: number | undefined): string | undefined {
  return codeName(codesFor(speciesId).allMethods, id);
}

/** Naam van kleed of leeftijd, in de codes van de groep van de soort */
export function lifeStageName(speciesId: number, id: number | undefined): string | undefined {
  return codeName(codesFor(speciesId).allLifeStages, id);
}

/** Groep van een soort, voor een label: "Ree (zoogdieren)"; leeg bij vogels */
export function groupLabel(speciesId: number): string | undefined {
  const group = groupOf(speciesId);
  return group === BIRDS ? undefined : GROUPS[group].name.toLowerCase();
}

/**
 * Soorten voor de soortkeuze in het formulier: vogels, en met de andere
 * groepen (ontwikkeloptie) ook zoogdieren, reptielen en amfibieën,
 * dagvlinders en libellen
 */
export function selectableSpecies(withGroups: boolean): Species[] {
  return withGroups ? allSpeciesAllGroups : allSpecies;
}

/**
 * Namen die per groep anders heten maar hetzelfde betekenen. Bij een wissel
 * van groep zoekt de app eerst dezelfde naam, dan een naam uit dezelfde rij.
 */
const SAME_MEANING = [
  ['dood', 'vondst (dood)'],
  ['adult', 'imago'],
];

function convertCode(
  from: Code[],
  to: Code[],
  id: number | undefined,
  fallback: number | undefined,
): number | undefined {
  const name = codeName(from, id);
  if (name === undefined) return fallback;
  const byName = (n: string) => to.find((c) => c.name === n)?.id;
  const same = byName(name);
  if (same !== undefined) return same;
  for (const row of SAME_MEANING) {
    if (!row.includes(name)) continue;
    for (const other of row) {
      const found = byName(other);
      if (found !== undefined) return found;
    }
  }
  // "overvliegend noord" bij vogels, maar alleen "overvliegend" bij zoogdieren
  if (name.startsWith('overvliegend ')) return byName('overvliegend') ?? fallback;
  return fallback;
}

export interface GroupFields {
  activityId?: number;
  methodId?: number;
  lifeStageId?: number;
}

/**
 * Gedrag, methode en kleed van een waarneming die van soortgroep wisselt
 * ("nee, een vos"), omgezet naar de codes van de nieuwe groep: op naam, anders
 * ter plaatse en gezien, en zonder kleed. Binnen dezelfde groep verandert er niets.
 */
export function convertCodes<T extends GroupFields>(
  fields: T,
  fromSpeciesId: number,
  toSpeciesId: number,
): T {
  return convertCodesBetween(fields, groupOf(fromSpeciesId), groupOf(toSpeciesId));
}

/** Als `convertCodes`, maar tussen twee groepen */
export function convertCodesBetween<T extends GroupFields>(
  fields: T,
  fromGroup: GroupId,
  toGroup: GroupId,
): T {
  if (fromGroup === toGroup) return fields;
  const from = GROUPS[fromGroup].codes;
  const to = GROUPS[toGroup].codes;
  const result = { ...fields };
  if (fields.activityId !== undefined)
    result.activityId = convertCode(
      from.allActivities,
      to.allActivities,
      fields.activityId,
      to.defaultActivity,
    );
  if (fields.methodId !== undefined)
    result.methodId = convertCode(
      from.allMethods,
      to.allMethods,
      fields.methodId,
      to.defaultMethod,
    );
  if (fields.lifeStageId !== undefined)
    result.lifeStageId = convertCode(
      from.allLifeStages,
      to.allLifeStages,
      fields.lifeStageId,
      undefined,
    );
  return result;
}

const FIELD_LISTS = {
  activityId: 'activities',
  methodId: 'methods',
  lifeStageId: 'lifeStages',
} as const;

/**
 * Groep waarvan de korte lijst (de codes in de prompt) deze code heeft. De
 * korte lijsten van de groepen hebben geen ID's gemeen (een test bewaakt dat).
 */
export function groupOfCode(field: keyof GroupFields, id: number): GroupId | undefined {
  return groups.find((g) => g.codes[FIELD_LISTS[field]].some((c) => c.id === id))?.id;
}
