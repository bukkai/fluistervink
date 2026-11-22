import dragonflyAttributes from '../../data/attributen-libellen.json';
import butterflyAttributes from '../../data/attributen-dagvlinders.json';
import herpAttributes from '../../data/attributen-reptielen-amfibieen.json';
import attributes from '../../data/attributen-vogels.json';
import mammalAttributes from '../../data/attributen-zoogdieren.json';
import beetleAttributes from '../../data/attributen-kevers.json';
import bugAttributes from '../../data/attributen-wantsen.json';
import beeAttributes from '../../data/attributen-bijen-wespen-mieren.json';
import mothAttributes from '../../data/attributen-nachtvlinders.json';
import grasshopperAttributes from '../../data/attributen-sprinkhanen.json';
import hoverflyAttributes from '../../data/attributen-zweefvliegen.json';
import aliasList from '../../data/bijnamen.json';
import allSpeciesList from '../../data/soorten-nl-alle.json';
import ebirdNames from '../../data/ebird-namen.json';
import namesEn from '../../data/namen-en.json';
import speciesList from '../../data/soorten-nl.json';
import spainList from '../../data/soorten-es.json';
import { language as appLanguage, LOCALE, t, type Language } from './i18n';
import { region, type Region } from './region';

// Vaste lijsten met waarneming.nl-ID's: soorten, gedrag, methode, kleed en
// telmethode. Zie docs/waarneming-nl.md. Naast vogels ook zoogdieren,
// reptielen en amfibieën, dagvlinders en libellen (docs/plan-soortgroepen.md);
// die zijn nog niet in de app te kiezen.

/**
 * Soortgroep van waarneming.nl: 1 vogels, 2 zoogdieren, 3 reptielen en
 * amfibieën, 4 dagvlinders, 5 libellen. Insecten (docs/plan-insecten.md):
 * 16 kevers, 15 wantsen, 17 bijen, wespen en mieren, 8 nachtvlinders,
 * 14 sprinkhanen en krekels, 18 vliegen en muggen (alleen zweefvliegen).
 */
export type GroupId = 1 | 2 | 3 | 4 | 5 | InsectGroupId;
export type InsectGroupId = 16 | 15 | 17 | 8 | 14 | 18;
export const BIRDS: GroupId = 1;
export const INSECT_GROUPS: readonly InsectGroupId[] = [16, 15, 17, 8, 14, 18];

export function isInsectGroup(group: GroupId): group is InsectGroupId {
  return (INSECT_GROUPS as readonly GroupId[]).includes(group);
}

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

/** Soort in de lijst van een ander land; `prompt`: het model kiest hieruit */
interface CountrySpecies extends Species {
  prompt?: boolean;
}

const countryBirds: Record<Exclude<Region, 'nl'>, CountrySpecies[]> = {
  es: spainList as CountrySpecies[],
};

/**
 * Soortenlijsten voor een land (region.ts, docs/plan-andere-landen.md). Een
 * ander land heeft alleen een eigen lijst met vogels, met de zeldzaamheid van
 * dat land; de andere soortgroepen blijven die van Nederland. Nederlandse
 * vogels die daar niet in staan, blijven op te zoeken (oude sessies), zonder
 * zeldzaamheid: dan zijn ze daar ook geen dwaalgast.
 */
export function speciesListsFor(r: Region): { prompt: Species[]; all: Species[] } {
  const dutchPrompt = speciesList as Species[];
  const dutchAll = allSpeciesList as Species[];
  if (r === 'nl') return { prompt: dutchPrompt, all: dutchAll };
  const birds = countryBirds[r].map(({ prompt, ...s }) => ({ s, prompt }));
  const ids = new Set(birds.map(({ s }) => s.id));
  return {
    prompt: [
      ...birds.filter(({ prompt }) => prompt).map(({ s }) => s),
      ...dutchPrompt.filter((s) => s.group !== BIRDS),
    ],
    all: [
      ...birds.map(({ s }) => s),
      ...dutchAll
        .filter((s) => !ids.has(s.id))
        .map((s) => (s.group === BIRDS ? { ...s, rarity: 0 } : s)),
    ],
  };
}

const lists = speciesListsFor(region);

/**
 * Soorten in de prompt van alle groepen met de keuze 'soortgroepen', zonder
 * insecten: die alleen met `insectsEnabled()` (`insectPromptSpecies`)
 */
const promptSpeciesAllGroups = lists.prompt.filter((s) => !isInsectGroup(s.group));

/** Verzamelsoorten van de insecten in de prompt ("Kever onbekend", "Hommel onbekend") */
const insectPromptSpecies = lists.prompt.filter((s) => isInsectGroup(s.group));

/** Vogels in de prompt: het model kiest alleen hieruit */
export const species = promptSpeciesAllGroups.filter((s) => s.group === BIRDS);
const promptSpeciesIds = new Set(species.map((s) => s.id));

/** Soorten van een andere groep die in de prompt kunnen */
export function promptSpeciesOf(group: GroupId): Species[] {
  return lists.prompt.filter((s) => s.group === group);
}

// ---------------------------------------------------------------------------
// Insecten (docs/plan-insecten.md, laag 1). In de prompt alleen verzamelsoorten
// per groep; de volledige lijsten (ruim 4000 soorten) staan in
// data/soorten-insecten.json, die src/lib/insects.ts pas laadt als het nodig
// is en hier aanmeldt. Aan voor het model met `setInsectsEnabled` (ontwikkeloptie
// `insecten` en de keuze 'soortgroepen').

/** Een insect uit data/soorten-insecten.json, met de Engelse naam erbij */
export interface InsectSpecies extends Species {
  en?: string;
}

let insectsOn = false;
let insectList: Species[] = [];

/** Gaan de insecten naar het model en in het soortveld? */
export function insectsEnabled(): boolean {
  return insectsOn;
}

export function setInsectsEnabled(on: boolean): void {
  insectsOn = on;
}

/** Zijn de volledige insectenlijsten geladen (namen op het scherm, opzoeken)? */
export function insectsLoaded(): boolean {
  return insectList.length > 0;
}

/** Alle soorten van alle groepen, ook zeer zeldzame: om een ID op te zoeken */
const allSpeciesAllGroups = lists.all;
const speciesById = new Map(allSpeciesAllGroups.map((s) => [s.id, s]));

/**
 * Alle vogels van waarneming.nl in het land, ook zeer zeldzame dwaalgasten.
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
const insectPromptByName = byName(insectPromptSpecies);
const insectPromptIds = new Set(insectPromptSpecies.map((s) => s.id));

const englishNames: Record<string, string> = namesEn.species;

/**
 * Engelse namen van een soort: die van waarneming.nl (data/namen-en.json, in
 * de Engelse prompt) en die van eBird (data/ebird-namen.json, Amerikaans:
 * "Northern Lapwing", "Arctic Loon"), zodat het model en de gebruiker allebei
 * goed zitten.
 */
export function englishNamesOf(s: Species): string[] {
  // eBird eerst: bij het opzoeken wint de laatste, de naam van waarneming.nl
  const names = [(ebirdNames as Record<string, string>)[s.id], englishNames[s.id]];
  return names.filter((n): n is string => Boolean(n));
}

/** Ook op Engelse naam; de naam van waarneming.nl wint (die staat in de prompt) */
const byEnglishName = (list: Species[]) =>
  new Map([
    ...byName(list),
    ...list.flatMap((s) => englishNamesOf(s).map((n) => [n.toLowerCase(), s] as const)),
  ]);
let englishMaps:
  | { birds: Map<string, Species>; all: Map<string, Species>; insects: Map<string, Species> }
  | undefined;

/**
 * Soort uit de lijst in de prompt, op Nederlandse of wetenschappelijke naam
 * (hoofdletters maken niet uit), en bij `language` 'en' ook op Engelse naam.
 * `withGroups`: ook de andere soortgroepen (keuze 'soortgroepen' bij Instellingen).
 */
export function findPromptSpecies(
  name: string,
  withGroups = false,
  language: Language = 'nl',
): Species | undefined {
  const key = name.trim().toLowerCase();
  const insects = withGroups && insectsOn;
  if (language === 'en') {
    englishMaps ??= {
      birds: byEnglishName(species),
      all: byEnglishName(promptSpeciesAllGroups),
      insects: byEnglishName(insectPromptSpecies),
    };
    return (
      (withGroups ? englishMaps.all : englishMaps.birds).get(key) ??
      (insects ? englishMaps.insects.get(key) : undefined)
    );
  }
  return (
    (withGroups ? promptSpeciesAllGroupsByName : promptSpeciesByName).get(key) ??
    (insects ? insectPromptByName.get(key) : undefined)
  );
}

/** Mag het model deze soort kiezen? */
export function isPromptSpecies(id: number, withGroups = false): boolean {
  if (withGroups && insectsOn && insectPromptIds.has(id)) return true;
  return (withGroups ? promptSpeciesAllGroupsIds : promptSpeciesIds).has(id);
}

// ---------------------------------------------------------------------------
// Dwaalgasten: zeer zeldzame soorten die niet in de prompt staan. Noemt de
// gebruiker er een, dan geeft het model de naam door (unlisted_species) en
// zoekt de app hem hier op. Geen uitheemse ontsnapte kooivogels (zeldzaamheid
// 0 in de bron): die zijn geen dwaalgast. Ook zeldzame andere dieren (wolf,
// knoflookpad), maar alleen met de andere soortgroepen aan.

/** Kleine letters, zonder accenten, spaties, streepjes en apostroffen */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

const VAGRANT_RARITY = 4;
const vagrants = allSpeciesAllGroups.filter(
  (s) => s.rarity === VAGRANT_RARITY && s.type === 'S' && !promptSpeciesAllGroupsIds.has(s.id),
);
const vagrantIds = new Set(vagrants.map((s) => s.id));

/**
 * Bijnamen van dwaalgasten (data/bijnamen.json): niet in de prompt, alleen om
 * de gezegde naam op te zoeken ("korenwolf" is de Europese Hamster).
 */
const vagrantAliases = (aliasList as Alias[]).filter((a) => vagrantIds.has(a.soort));

interface VagrantIndex {
  vagrantKeys: { key: string; s: Species }[];
  promptKeys: string[];
  promptKeysAllGroups: string[];
}

/** Namen om op te zoeken: Nederlands en wetenschappelijk, of Engels (twee namen) en wetenschappelijk */
function vagrantIndex(language: Language): VagrantIndex {
  const keysOf = (s: Species) =>
    [...(language === 'en' ? englishNamesOf(s) : [s.name]), s.scientific].map(normalizeName);
  return {
    vagrantKeys: [
      ...vagrants.flatMap((s) => keysOf(s).map((key) => ({ key, s }))),
      // De bijnamen zijn Nederlands ("korenwolf")
      ...(language === 'nl' ? vagrantAliases : []).flatMap((a) =>
        a.bijnamen.map((name) => ({ key: normalizeName(name), s: speciesById.get(a.soort)! })),
      ),
    ],
    promptKeys: species.flatMap(keysOf),
    promptKeysAllGroups: promptSpeciesAllGroups.flatMap(keysOf),
  };
}

const vagrantIndexes = new Map<Language, VagrantIndex>();

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
 * Dwaalgast bij een gezegde naam (Nederlands of wetenschappelijk; bij
 * `language` 'en' Engels of wetenschappelijk), met een paar letters speling.
 * Liever geen soort dan een verkeerde: niets als twee dwaalgasten even goed
 * passen, of als een soort uit de prompt minstens zo goed past
 * ("roodborsttapuit" is geen Roodkeeltapuit). `withGroups`: ook andere dieren
 * (keuze 'soortgroepen' bij Instellingen), anders alleen vogels.
 */
export function findVagrant(
  name: string,
  withGroups = false,
  language: Language = 'nl',
): Species | undefined {
  const said = normalizeName(name);
  if (!said) return undefined;
  let index = vagrantIndexes.get(language);
  if (!index) vagrantIndexes.set(language, (index = vagrantIndex(language)));
  // Ook in het enkelvoud: het model geeft de naam soms zoals gezegd ("korenwolven")
  const forms = language === 'en' ? englishSingulars(said) : singulars(said);
  for (const form of new Set([said, ...forms])) {
    const found = findVagrantKey(form, withGroups, index);
    if (found) return found;
  }
  return undefined;
}

/** Mogelijke Engelse enkelvouden: wolves, geese, mice, buntings, finches, ibises */
function englishSingulars(said: string): string[] {
  return [
    said.replace(/geese$/, 'goose'),
    said.replace(/mice$/, 'mouse'),
    said.replace(/ves$/, 'f'),
    said.replace(/ies$/, 'y'),
    said.replace(/es$/, ''),
    said.replace(/s$/, ''),
  ].filter((form) => form !== said && form.length >= 3);
}

/** Mogelijke enkelvouden van een genormaliseerde naam: korenwolven, knoflookpadden, rietgorzen */
function singulars(said: string): string[] {
  return [
    said.replace(/ven$/, 'f'),
    said.replace(/zen$/, 's'),
    said.replace(/([bdgklmnprt])\1en$/, '$1'),
    said.replace(/en$/, ''),
    said.replace(/s$/, ''),
  ].filter((form) => form !== said && form.length >= 3);
}

function findVagrantKey(
  said: string,
  withGroups: boolean,
  { vagrantKeys, promptKeys, promptKeysAllGroups }: VagrantIndex,
): Species | undefined {
  const max = allowedTypos(said.length);
  let best: Species | undefined;
  let bestDistance = max + 1;
  let tie = false;
  for (const { key, s } of vagrantKeys) {
    if (!withGroups && s.group !== BIRDS) continue;
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
  const listed = withGroups ? promptKeysAllGroups : promptKeys;
  if (listed.some((key) => editDistance(said, key, bestDistance) <= bestDistance)) {
    return undefined;
  }
  return best;
}

/**
 * Namen waaronder een insect te vinden is: de naam, zonder wat tussen haakjes
 * staat en zonder "onbekend" ("Goudhaantje (kever) onbekend" ook als
 * "goudhaantje"), en de wetenschappelijke naam. In het Engels de Engelse naam.
 */
function insectKeys(s: Species, language: Language): string[] {
  const name = language === 'en' ? (englishNames[s.id] ?? '') : s.name;
  const short = name.replace(/\([^)]*\)/g, ' ').replace(/\b(onbekend|unknown)\b/gi, ' ');
  return [...new Set([name, short, s.scientific].map(normalizeName).filter(Boolean))];
}

const insectIndexes = new Map<string, { key: string; s: Species }[]>();

/**
 * Meldt de volledige insectenlijsten aan (src/lib/insects.ts): hun namen op het
 * scherm en in de export, het soortveld en het opzoeken met `findInsect`.
 */
export function registerInsects(list: InsectSpecies[]): void {
  insectList = list.map(({ en, ...s }) => {
    if (en) englishNames[s.id] ??= en;
    speciesById.set(s.id, s);
    return s;
  });
  insectIndexes.clear();
  selectable = undefined;
}

/**
 * Insect bij een gezegde naam, binnen één groep (die van de verzamelsoort die
 * het model koos: "Kever onbekend" zoekt bij de kevers). Net als bij
 * dwaalgasten met een paar letters speling en in het enkelvoud; niets als twee
 * soorten even goed passen. Ook de verzamelsoorten van de groep tellen mee.
 */
export function findInsect(
  name: string,
  group: GroupId,
  language: Language = 'nl',
): Species | undefined {
  const said = normalizeName(name);
  if (!said || !isInsectGroup(group)) return undefined;
  const indexKey = `${language}:${group}`;
  let index = insectIndexes.get(indexKey);
  if (!index) {
    const inGroup = [...insectPromptSpecies, ...insectList].filter((s) => s.group === group);
    index = inGroup.flatMap((s) => insectKeys(s, language).map((key) => ({ key, s })));
    insectIndexes.set(indexKey, index);
  }
  const forms = language === 'en' ? englishSingulars(said) : singulars(said);
  for (const form of new Set([said, ...forms])) {
    const max = allowedTypos(form.length);
    let best: Species | undefined;
    let bestDistance = max + 1;
    let tie = false;
    for (const { key, s } of index) {
      const d = editDistance(form, key, max);
      if (d < bestDistance) {
        best = s;
        bestDistance = d;
        tie = false;
      } else if (d === bestDistance && best && s.id !== best.id) {
        tie = true;
      }
    }
    if (best && !tie) return best;
  }
  return undefined;
}

/**
 * Bijnamen en afkortingen uit vogelaarsjargon ("tova", "robotap", "KBV"),
 * zie data/bijnamen.json. `naam` staat er alleen voor de leesbaarheid.
 * `verhaspelingen`: wat de spraakherkenning vaak van de soort maakt maar geen
 * vogel is ("goudborstje" voor roodborstje). Die gaan wel naar het model, niet
 * in de prompt van de spraakherkenning: daar zouden ze de verkeerde schrijfwijze
 * juist aanmoedigen.
 */
export interface Alias {
  soort: number;
  naam: string;
  bijnamen: string[];
  verhaspelingen?: string[];
}

/** Alles waaraan het model de soort herkent: bijnamen en verhaspelingen */
export const heardNames = (a: Alias): string[] => [...a.bijnamen, ...(a.verhaspelingen ?? [])];

const allAliases = (aliasList as Alias[]).filter((a) => {
  if (isPromptSpecies(a.soort, true)) return true;
  if (vagrantIds.has(a.soort)) return false; // alleen voor findVagrant
  // In een ander land ontbreken sommige Nederlandse soorten gewoon
  if (region !== 'nl') return false;
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

const DEFAULT_ACTIVITY = 1; // ter plaatse
const DEFAULT_METHOD = 48; // gezien
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
  // Insecten (docs/plan-insecten.md): wat je zonder net of val ziet
  16: {
    id: 16,
    name: 'Kevers',
    codes: groupCodes(
      beetleAttributes,
      {
        // ter plaatse, foeragerend, in copula, eileggend, zonnend, vliegend, op
        // licht, dood, slachtoffer verkeer
        activities: [94, 3188, 3023, 3024, 3218, 3220, 3027, 3030, 3029],
        // gezien, gehoord
        methods: [473, 474],
        // imago, larve/nimf, pop, ei
        lifeStages: [1042, 1048, 1089, 1041],
      },
      { activity: 94, method: 473 },
    ),
  },
  15: {
    id: 15,
    name: 'Wantsen, cicaden en plantenluizen',
    codes: groupCodes(
      bugAttributes,
      {
        // ter plaatse, foeragerend, in copula, eileggend, zonnend, op licht,
        // dood, slachtoffer verkeer
        activities: [98, 3187, 3013, 3014, 3236, 3017, 3020, 3019],
        // gezien, gehoord, gehoord en gezien
        methods: [448, 449, 450],
        // imago, larve/nimf, ei
        lifeStages: [1028, 1034, 1027],
      },
      { activity: 98, method: 448 },
    ),
  },
  17: {
    id: 17,
    name: 'Bijen, wespen en mieren',
    codes: groupCodes(
      beeAttributes,
      {
        // ter plaatse, foeragerend, in copula, nest, nestbouw, overvliegend,
        // zonnend, dood, slachtoffer verkeer
        activities: [95, 3185, 3033, 3036, 3241, 3276, 3239, 3040, 3039],
        // gezien
        methods: [498],
        // imago, koningin, werkster, larve/nimf
        lifeStages: [1056, 1060, 1061, 1062],
      },
      { activity: 95, method: 498 },
    ),
  },
  8: {
    id: 8,
    name: 'Nachtvlinders',
    codes: groupCodes(
      mothAttributes,
      {
        // ter plaatse, overvliegend, foeragerend, in copula, op licht, rustend,
        // eileggend, dood, spinselnest
        activities: [82, 3203, 3182, 84, 90, 3205, 85, 83, 3133],
        // gezien
        methods: [273],
        // imago, rups, pop, ei
        lifeStages: [103, 101, 102, 106],
      },
      { activity: 82, method: 273 },
    ),
  },
  14: {
    id: 14,
    name: 'Sprinkhanen en krekels',
    codes: groupCodes(
      grasshopperAttributes,
      {
        // ter plaatse, baltsend / zingend, in copula, eileggend, zonnend, dood
        activities: [97, 3001, 3004, 3005, 3223, 3007],
        // gezien, gehoord, gezien en gehoord, batdetector
        methods: [423, 424, 426, 419],
        // imago, larve/nimf
        lifeStages: [1014, 1020],
      },
      { activity: 97, method: 423 },
    ),
  },
  18: {
    id: 18,
    name: 'Zweefvliegen',
    codes: groupCodes(
      hoverflyAttributes,
      {
        // ter plaatse, foeragerend, in copula, eileggend, zonnend, dood,
        // slachtoffer raambotsing
        activities: [96, 3186, 3043, 3044, 3227, 3050, 3228],
        // gezien
        methods: [523],
        // imago, larve/nimf
        lifeStages: [1070, 1076],
      },
      { activity: 96, method: 523 },
    ),
  },
};

/** Groepen zonder insecten: vogels en de andere dieren van de keuze 'soortgroepen' */
export const groups: Group[] = Object.values(GROUPS).filter((g) => !isInsectGroup(g.id));

/** Insectengroepen, in de volgorde van INSECT_GROUPS */
export const insectGroups: Group[] = INSECT_GROUPS.map((id) => GROUPS[id]);

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

// ---------------------------------------------------------------------------
// Namen in een andere taal (docs/plan-engels.md, stap 2). De ID's blijven die
// van waarneming.nl; de taal is alleen weergave. De namen per taal staan apart
// van de soortenlijst (data/namen-en.json, docs/plan-andere-landen.md, keuze 1).
// Op het scherm via de `…Label`-functies hieronder, in de taal van de app;
// export naar waarneming.nl en de Nederlandse prompt blijven Nederlands.

export type { Language };

interface Names {
  species: Record<string, string>;
  attributes: Record<string, Record<'activity' | 'method' | 'life_stage', Record<string, string>>>;
  counting_method: Record<string, string>;
}

const NAMES: Record<Exclude<Language, 'nl'>, Names> = { en: namesEn };

/** Bestand met de attributen van een groep: data/attributen-<naam>.json */
const ATTRIBUTE_FILES: Record<GroupId, string> = {
  1: 'vogels',
  2: 'zoogdieren',
  3: 'reptielen-amfibieen',
  4: 'dagvlinders',
  5: 'libellen',
  16: 'kevers',
  15: 'wantsen',
  17: 'bijen-wespen-mieren',
  8: 'nachtvlinders',
  14: 'sprinkhanen',
  18: 'zweefvliegen',
};

/**
 * Naam van een soort in een taal. Zonder naam in die taal de wetenschappelijke
 * naam (begrijpt elke vogelaar), en "soort 123" als het ID onbekend is.
 */
export function speciesNameIn(language: Language, id: number): string {
  if (language === 'nl') return speciesName(id);
  const s = getSpecies(id);
  if (!s) return `species ${id}`;
  return NAMES[language].species[s.id] ?? s.scientific;
}

type AttributeField = 'activity' | 'method' | 'life_stage';

function attributeNameIn(
  language: Exclude<Language, 'nl'>,
  field: AttributeField,
  speciesId: number,
  id: number | undefined,
): string | undefined {
  if (id === undefined) return undefined;
  return NAMES[language].attributes[ATTRIBUTE_FILES[groupOf(speciesId)]]?.[field][id];
}

/** Naam van een code van een groep in een taal, voor de Engelse prompt */
export function groupCodeNameIn(
  language: Exclude<Language, 'nl'>,
  group: GroupId,
  field: AttributeField,
  id: number,
): string | undefined {
  return NAMES[language].attributes[ATTRIBUTE_FILES[group]]?.[field][id];
}

/** Naam van het gedrag in een taal ("flying over"), in de codes van de groep van de soort */
export function activityNameIn(
  language: Language,
  speciesId: number,
  id: number | undefined,
): string | undefined {
  return language === 'nl'
    ? activityName(speciesId, id)
    : attributeNameIn(language, 'activity', speciesId, id);
}

/** Naam van de methode in een taal ("heard") */
export function methodNameIn(
  language: Language,
  speciesId: number,
  id: number | undefined,
): string | undefined {
  return language === 'nl'
    ? methodName(speciesId, id)
    : attributeNameIn(language, 'method', speciesId, id);
}

/** Naam van kleed of leeftijd in een taal ("juvenile") */
export function lifeStageNameIn(
  language: Language,
  speciesId: number,
  id: number | undefined,
): string | undefined {
  return language === 'nl'
    ? lifeStageName(speciesId, id)
    : attributeNameIn(language, 'life_stage', speciesId, id);
}

/** Naam van de telmethode in een taal ("estimated"); dezelfde codes voor elke groep */
export function countingMethodNameIn(
  language: Language,
  id: number | undefined,
): string | undefined {
  if (language === 'nl') return codeName(countingMethods, id);
  return id === undefined ? undefined : NAMES[language].counting_method[id];
}

// Namen voor op het scherm, in de taal van de app (ontwikkeloptie "English",
// stap 3 van docs/plan-engels.md). Niet voor de export naar waarneming.nl of de
// prompt: die kiezen hun taal zelf.

/** Naam van een soort op het scherm */
export function speciesLabel(id: number): string {
  return speciesNameIn(appLanguage, id);
}

/**
 * Engelse namen van waarneming.nl hebben soms hoofdletters ("Foraging /
 * Eating", "Oil spill victim"), de rest niet: op het scherm overal klein
 */
function lower(name: string | undefined): string | undefined {
  return appLanguage === 'nl' ? name : name?.toLowerCase();
}

/** Naam van het gedrag op het scherm */
export function activityLabel(speciesId: number, id: number | undefined): string | undefined {
  return lower(activityNameIn(appLanguage, speciesId, id));
}

/** Naam van de methode op het scherm */
export function methodLabel(speciesId: number, id: number | undefined): string | undefined {
  return lower(methodNameIn(appLanguage, speciesId, id));
}

/** Naam van kleed of leeftijd op het scherm */
export function lifeStageLabel(speciesId: number, id: number | undefined): string | undefined {
  return lower(lifeStageNameIn(appLanguage, speciesId, id));
}

/** Naam van de telmethode op het scherm */
export function countingMethodLabel(id: number | undefined): string | undefined {
  return lower(countingMethodNameIn(appLanguage, id));
}

/** Naam van een soortgroep op het scherm: "Zoogdieren" */
export function groupName(group: GroupId): string {
  return t(`group.${group}`);
}

/** Groep van een soort, voor een label: "Ree (zoogdieren)"; leeg bij vogels */
export function groupLabel(speciesId: number): string | undefined {
  const group = groupOf(speciesId);
  return group === BIRDS ? undefined : groupName(group).toLowerCase();
}

let selectable: { insects: boolean; list: Species[] } | undefined;

/**
 * Soorten voor de soortkeuze in het formulier: vogels, en met de andere
 * groepen ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen.
 * Insecten alleen met `insectsEnabled()`, dan ook de volledige lijsten (als
 * ze geladen zijn).
 */
export function selectableSpecies(withGroups: boolean): Species[] {
  if (!withGroups) return allSpecies;
  if (selectable?.insects !== insectsOn) {
    selectable = {
      insects: insectsOn,
      list: insectsOn
        ? [...allSpeciesAllGroups, ...insectList]
        : allSpeciesAllGroups.filter((s) => !isInsectGroup(s.group)),
    };
  }
  return selectable.list;
}

/** Kleine letters en zonder accenten, voor het zoeken: "gele kwikstaart" */
function searchable(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Zeldzaamheid om op te sorteren: onbekend (0) achter zeer zeldzaam (4) */
function commonness(s: Species): number {
  return s.rarity || 5;
}

/**
 * Suggesties voor het soortveld, op de naam in de taal van de app: eerst namen die met de tekst beginnen, dan
 * namen met een woord dat ermee begint ("kievit" → Indische Kievit), dan de
 * wetenschappelijke naam, dan ergens in de naam ("zwaluw" → Boerenzwaluw). Binnen elke stap de
 * algemene soorten eerst (zeldzaamheid 0, onbekend, achteraan). Vervangt de
 * datalist, die de Android-WebView als los venstertje tekende dat bij het
 * openen van het toetsenbord op de verkeerde plek bleef staan (16 nov).
 */
export function searchSpecies(choices: Species[], query: string, limit = 8): Species[] {
  const q = searchable(query);
  if (!q) return [];
  const ranked: { s: Species; name: string; rank: number }[] = [];
  for (const s of choices) {
    const label = speciesLabel(s.id);
    const name = searchable(label);
    const rank = name.startsWith(q)
      ? 0
      : name.split(/[\s-]+/).some((word) => word.startsWith(q))
        ? 1
        : searchable(s.scientific).startsWith(q)
          ? 2
          : name.includes(q)
            ? 3
            : -1;
    if (rank >= 0) ranked.push({ s, name: label, rank });
  }
  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        commonness(a.s) - commonness(b.s) ||
        a.name.localeCompare(b.name, LOCALE),
    )
    .slice(0, limit)
    .map(({ s }) => s);
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
  return Object.values(GROUPS).find((g) => g.codes[FIELD_LISTS[field]].some((c) => c.id === id))
    ?.id;
}
