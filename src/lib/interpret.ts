import { t, type Language } from './i18n';
import type Anthropic from '@anthropic-ai/sdk';
import { timeFormat } from './format';
import { distanceMeters } from './geo';
import { createMessage, type Timing } from './api';
import type { Observation, Position, SpokenPlace } from './db';
import {
  DIRECTIONS,
  MAX_DISTANCE_M,
  describePlace,
  parsePlaceText,
  type Direction,
} from './spokenPlace';
import {
  activities,
  activityName,
  BIRDS,
  codesFor,
  convertCodesBetween,
  countingMethods,
  getSpecies,
  groupOf,
  groupOfCode,
  lifeStageName,
  methodName,
  speciesName,
  speciesNameIn,
  activityNameIn,
  methodNameIn,
  lifeStageNameIn,
  findPromptSpecies,
  findVagrant,
  isPromptSpecies,
  lifeStages,
  methods,
  type Code,
  type GroupFields,
} from './vocab';
import { MAX_CANDIDATES, variant } from './prompt';

// Zet een uitgesproken (of getypte) uitspraak om in acties. Het model krijgt
// een vaste systeemprompt met de soortenlijst (gecachet, zie prompt.ts) en per
// aanroep de laatste waarnemingen van de sessie, zodat "die", "de vorige" en
// "nog drie" werken. Het antwoordt alleen met tool calls; de app controleert
// ze hier en voert ze daarna uit (applyActions.ts).

export const MODEL = 'claude-haiku-5-5';

/** Zoveel recente waarnemingen krijgt het model als context. */
const CONTEXT_SIZE = 10;

// ---------------------------------------------------------------------------
// Acties: wat het model kan teruggeven, na validatie door de app

export interface ObservationFields {
  speciesId?: number;
  count?: number;
  countingMethodId?: number;
  activityId?: number;
  methodId?: number;
  lifeStageId?: number;
  sex?: 'male' | 'female';
  uncertain?: boolean;
  uncertainReason?: string;
  remarks?: string;
  privateNote?: string;
  spokenPlace?: SpokenPlace;
  candidates?: number[];
}

export type Action =
  | { type: 'add'; fields: ObservationFields & { speciesId: number; count: number } }
  | { type: 'update'; observationId: string; fields: ObservationFields; addCount?: number }
  | { type: 'delete'; observationId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'dev_note'; text?: string };

export interface Interpretation {
  actions: Action[];
  /** Tool calls die niet geldig waren (onbekende soort, verkeerde verwijzing) */
  rejected: string[];
  /** Wat de app herstelde, zoals een soort-ID dat niet bij de naam hoorde */
  warnings: string[];
  /** Volledige respons van de API, bewaard voor de testset */
  response: Anthropic.Message;
  /** De recente waarnemingen zoals het model ze kreeg */
  context: string;
  /** ID's van die waarnemingen, in volgorde (#1 eerst), om verwijzingen na te gaan */
  contextIds: string[];
  timing: Timing;
}

// ---------------------------------------------------------------------------
// Aanroep

/** Vanaf deze afstand staat de afstand in de context (zie "nog een X" in de prompt) */
const FAR_AWAY_M = 250;

/**
 * Woorden in de context en het bericht voor het model, per taal. De
 * systeemprompt verwijst naar sommige ("… m hiervandaan", "… m away"); houd
 * ze gelijk. Het Nederlands staat hier precies zoals het altijd was.
 */
const WORDS = {
  nl: {
    away: 'hiervandaan',
    decimal: ',',
    none: '(nog geen waarnemingen)',
    male: 'man',
    female: 'vrouw',
    uncertain: 'onzeker',
    candidates: 'twijfel tussen',
    remarks: 'opmerking',
    note: 'notitie',
    place: 'plek',
    or: ' of ',
    trektel: 'Dit is een stuk uit een trektelling.',
    recent: 'Recente waarnemingen in deze sessie (#1 = meest recent):',
    said: 'Uitspraak',
  },
  en: {
    away: 'away',
    decimal: '.',
    none: '(no observations yet)',
    male: 'male',
    female: 'female',
    uncertain: 'uncertain',
    candidates: 'torn between',
    remarks: 'remark',
    note: 'note',
    place: 'place',
    or: ' or ',
    trektel: 'This is a chunk from a migration count.',
    recent: 'Recent observations in this session (#1 = most recent):',
    said: 'Voice note',
  },
} satisfies Record<Language, Record<string, string>>;

function farAway(
  obs: Observation,
  here: Position | undefined,
  language: Language,
): string | undefined {
  if (!here || !obs.position) return undefined;
  const meters = distanceMeters(obs.position, here);
  if (meters < FAR_AWAY_M) return undefined;
  const { away, decimal } = WORDS[language];
  return meters < 1000
    ? `${Math.round(meters / 50) * 50} m ${away}`
    : `${(meters / 1000).toFixed(1).replace('.', decimal)} km ${away}`;
}

/**
 * De recente waarnemingen zoals het model ze krijgt, #1 = nieuwste.
 * @param here Positie van de uitspraak, als die er al is
 * @param language Taal van de uitspraak en dus van de prompt
 */
export function describeContext(
  context: Observation[],
  here?: Position,
  language: Language = 'nl',
): string {
  return context.length
    ? context.map((obs, i) => `#${i + 1} ${describe(obs, here, language)}`).join('\n')
    : WORDS[language].none;
}

/** Namen in de taal van de prompt; voor het Nederlands precies zoals altijd */
const namesIn = (language: Language) =>
  language === 'nl'
    ? { species: speciesName, activity: activityName, method: methodName, lifeStage: lifeStageName }
    : {
        species: (id: number) => speciesNameIn(language, id),
        activity: (speciesId: number, id?: number) => activityNameIn(language, speciesId, id),
        method: (speciesId: number, id?: number) => methodNameIn(language, speciesId, id),
        lifeStage: (speciesId: number, id?: number) => lifeStageNameIn(language, speciesId, id),
      };

function describe(obs: Observation, here: Position | undefined, language: Language): string {
  const words = WORDS[language];
  const names = namesIn(language);
  const parts = [
    `${obs.count} × ${names.species(obs.speciesId)}`,
    names.activity(obs.speciesId, obs.activityId),
    names.method(obs.speciesId, obs.methodId),
    names.lifeStage(obs.speciesId, obs.lifeStageId),
    obs.sex === 'male' ? words.male : obs.sex === 'female' ? words.female : undefined,
    obs.uncertain ? words.uncertain : undefined,
    obs.candidates?.length
      ? `${words.candidates}: ${obs.candidates.map((id) => names.species(id)).join(', ')}`
      : undefined,
    obs.remarks ? `${words.remarks}: "${obs.remarks}"` : undefined,
    obs.privateNote ? `${words.note}: "${obs.privateNote}"` : undefined,
    obs.spokenPlace ? `${words.place}: "${obs.spokenPlace.text}"` : undefined,
    farAway(obs, here, language),
  ];
  return `${timeFormat.format(obs.observedAt)} ${parts.filter(Boolean).join(', ')}`;
}

/**
 * Tool calls uit een antwoord van het model, gevalideerd. Los, zodat de
 * testset ook bewaarde antwoorden kan scoren.
 * @param context De recente waarnemingen zoals het model ze kreeg (#1 eerst)
 */
/**
 * De gezegde naam uit een twijfelreden als "Gezegd: wolf (niet in de lijst)",
 * alleen bij een verzamelsoort (zoals de prompt het vraagt), anders niets.
 */
function saidInReason(speciesId: number | undefined, reason: unknown): string | undefined {
  if (speciesId === undefined || !/onbekend/i.test(speciesName(speciesId))) return undefined;
  if (typeof reason !== 'string') return undefined;
  return (
    reason.match(/gezegd:\s*"?([^"(;,]+?)"?\s*\(niet in de lijst/i)?.[1] ??
    reason.match(/said:\s*"?([^"(;,]+?)"?\s*\(not (?:in|on) the list/i)?.[1]
  );
}

export function parseResponse(
  response: Anthropic.Message,
  context: Observation[],
  withGroups = false,
  language: Language = 'nl',
): { actions: Action[]; rejected: string[]; warnings: string[] } {
  const actions: Action[] = [];
  const rejected: string[] = [];
  const warnings: string[] = [];
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;
    const result = toAction(block, context, warnings, withGroups, language);
    if (typeof result === 'string') rejected.push(result);
    else actions.push(result);
  }
  return { actions, rejected, warnings };
}

/**
 * Het bericht bij elke aanroep: de context en de uitspraak. Een trektelstuk
 * krijgt er een regel bij, zodat het model weet dat een vogel zonder gedrag
 * overvliegend is (de regel zelf staat in de systeemprompt, die gecachet blijft).
 */
export function userMessage(
  contextText: string,
  transcript: string,
  trektel: boolean,
  language: Language = 'nl',
): string {
  const words = WORDS[language];
  const kind = trektel ? `${words.trektel}\n\n` : '';
  return `${kind}${words.recent}\n${contextText}\n\n${words.said}: "${transcript}"`;
}

/**
 * @param transcript De uitspraak als tekst
 * @param recent Recente waarnemingen van de sessie, nieuwste eerst
 * @param options `here`: positie van de uitspraak, voor de afstand tot eerdere
 *   waarnemingen. `model` en `contextText` alleen voor de testset
 *   (scripts/testset.mjs): een ander model, of de context precies zoals hij
 *   destijds was. `sessionId`: voor het verbruik per sessie. `groups`: ook
 *   andere dieren dan vogels. `trektel`: een stuk uit een trektelling
 */
export async function interpret(
  transcript: string,
  recent: Observation[],
  options: {
    here?: Position;
    model?: string;
    contextText?: string;
    sessionId?: string;
    groups?: boolean;
    trektel?: boolean;
    language?: Language;
  } = {},
): Promise<Interpretation> {
  const withGroups = options.groups ?? false;
  const language = options.language ?? 'nl';
  const { system, tools } = variant(withGroups, language);
  const context = recent.slice(0, CONTEXT_SIZE);
  const contextText = options.contextText ?? describeContext(context, options.here, language);

  const { data: response, timing } = await createMessage<Anthropic.Message>(
    {
      model: options.model ?? MODEL,
      max_tokens: 4096,
      // Weinig nadenken: snelheid telt in het veld, en de taak is eenvoudig
      output_config: { effort: 'low' },
      tools,
      // Tools en systeemprompt veranderen nooit; met dit cachepunt worden ze na
      // de eerste aanroep goedkoop en sneller ingelezen.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: userMessage(contextText, transcript, options.trektel ?? false, language),
        },
      ],
    } satisfies Anthropic.MessageCreateParamsNonStreaming,
    options.sessionId,
  );

  if (response.stop_reason === 'refusal') {
    throw new Error('Het model weigerde de uitspraak te verwerken');
  }

  const { actions, rejected, warnings } = parseResponse(response, context, withGroups, language);
  return {
    actions,
    rejected,
    warnings,
    response,
    context: contextText,
    contextIds: context.map((obs) => obs.id),
    timing,
  };
}

// ---------------------------------------------------------------------------
// Validatie: het model kan zich vergissen, de app vertrouwt niets blind

interface RawFields {
  ref?: number;
  /** add_dev_note */
  text?: string;
  species_name?: string;
  species_id?: number;
  unlisted_species?: string;
  count?: number;
  add_count?: number;
  counting_method_id?: number;
  activity_id?: number;
  method_id?: number;
  life_stage_id?: number | null;
  sex?: 'male' | 'female' | null;
  uncertain?: boolean;
  uncertain_reason?: string;
  remarks?: string;
  private_note?: string;
  place_description?: string | null;
  place_distance_m?: number | null;
  place_direction?: string | null;
  candidate_species?: string[];
}

/**
 * Plek uit de uitspraak. Een afstand of richting die niet kan, valt weg (met
 * een waarschuwing); de omschrijving blijft dan, zodat de gebruiker thuis de
 * plek op de kaart zet.
 */
/**
 * Tekst van het model, of undefined als hij leeg is. Het model zet soms
 * "null" als tekst in een veld dat hij leeg had moeten laten (18 nov: plek
 * "null" bij "Grote rotslijster en vijf vinken").
 */
export function modelText(value: string | null | undefined): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || /^(null|undefined|none|n\/a|-)$/i.test(text)) return undefined;
  return text;
}

function toSpokenPlace(
  tool: string,
  input: RawFields,
  warnings: string[],
  language: Language,
): SpokenPlace | undefined {
  let distanceM = input.place_distance_m ?? undefined;
  if (
    distanceM !== undefined &&
    !(Number.isInteger(distanceM) && distanceM >= 1 && distanceM <= MAX_DISTANCE_M)
  ) {
    warnings.push(`${tool}: afstand ${distanceM} m genegeerd`);
    distanceM = undefined;
  }
  let direction = input.place_direction ?? undefined;
  if (direction !== undefined && !Object.hasOwn(DIRECTIONS, direction)) {
    warnings.push(`${tool}: windrichting "${direction}" genegeerd`);
    direction = undefined;
  }
  const text =
    modelText(input.place_description) ||
    describePlace(distanceM, direction as Direction, language);
  if (!text) return undefined;
  // Het model laat de afstand soms weg terwijl die in de omschrijving staat
  // ("300 meter ten westen" → alleen W); dan haalt de app hem er zelf uit
  const fromText = parsePlaceText(text, language);
  distanceM ??= fromText.distanceM;
  direction ??= fromText.direction;
  return {
    text,
    ...(distanceM !== undefined && { distanceM }),
    ...(direction !== undefined && { direction: direction as Direction }),
  };
}

/**
 * Soorten waartussen het model twijfelt. Een naam die niet in de lijst staat
 * valt weg; blijven er minder dan twee over, dan is er niets te kiezen.
 */
function toCandidates(
  tool: string,
  names: unknown,
  warnings: string[],
  withGroups: boolean,
  language: Language,
): number[] | undefined {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const ids: number[] = [];
  for (const name of names) {
    const found =
      typeof name === 'string' ? findPromptSpecies(name, withGroups, language) : undefined;
    if (!found) warnings.push(`${tool}: kandidaat "${String(name)}" staat niet in de lijst`);
    else if (!ids.includes(found.id)) ids.push(found.id);
  }
  if (ids.length < 2 || ids.length > MAX_CANDIDATES) {
    warnings.push(`${tool}: ${ids.length} kandidaten, genegeerd`);
    return undefined;
  }
  return ids;
}

const validCode = (codes: Code[], id: number | undefined) =>
  id === undefined || codes.some((c) => c.id === id);

const CODE_FIELDS = ['activityId', 'methodId', 'lifeStageId'] as const;
const CODE_LISTS = {
  activityId: 'activities',
  methodId: 'methods',
  lifeStageId: 'lifeStages',
} as const;

/**
 * Gedrag, methode en kleed moeten bij de groep van de soort horen ("ter
 * plaatse" is 1 bij vogels, 15 bij zoogdieren). Gaf het model een code van een
 * andere groep, dan zet de app die op naam om (anders ter plaatse en gezien),
 * met een waarschuwing. Geeft false bij een code die bij geen enkele groep hoort.
 */
function fitCodes(
  tool: string,
  fields: GroupFields,
  speciesId: number | undefined,
  warnings: string[],
): boolean {
  const codes = speciesId !== undefined ? codesFor(speciesId) : undefined;
  const group = speciesId !== undefined ? groupOf(speciesId) : BIRDS;
  for (const field of CODE_FIELDS) {
    const id = fields[field];
    if (id === undefined) continue;
    if (codes && validCode(codes[CODE_LISTS[field]], id)) continue;
    const from = groupOfCode(field, id);
    if (from === undefined || !codes) return false;
    const converted = convertCodesBetween({ [field]: id }, from, group)[field];
    warnings.push(
      `${tool}: code ${id} hoort bij een andere soortgroep; ${converted ?? 'geen'} gebruikt`,
    );
    if (converted === undefined) delete fields[field];
    else fields[field] = converted;
  }
  return true;
}

/**
 * Geeft een actie terug, of een omschrijving van wat er mis was. Wat de app
 * zelf herstelde (soortnaam en ID die niet bij elkaar horen) komt in `warnings`.
 */
function toAction(
  block: Anthropic.ToolUseBlock,
  context: Observation[],
  warnings: string[],
  withGroups: boolean,
  language: Language,
): Action | string {
  const input = block.input as RawFields;

  if (block.name === 'undo') return { type: 'undo' };
  if (block.name === 'redo') return { type: 'redo' };
  if (block.name === 'add_dev_note') {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    return { type: 'dev_note', ...(text && { text }) };
  }

  const fields: ObservationFields = {
    speciesId: input.species_id,
    count: input.count,
    countingMethodId: input.counting_method_id,
    activityId: input.activity_id,
    methodId: input.method_id,
    lifeStageId: input.life_stage_id ?? undefined,
    sex: input.sex ?? undefined,
    uncertain: input.uncertain,
    uncertainReason: input.uncertain ? input.uncertain_reason : undefined,
    remarks: modelText(input.remarks),
    privateNote: modelText(input.private_note),
    spokenPlace: toSpokenPlace(block.name, input, warnings, language),
  };
  // Weglaten wat het model niet meegaf, zodat een update alleen wijzigt wat bedoeld is
  for (const key of Object.keys(fields) as (keyof ObservationFields)[]) {
    if (fields[key] === undefined) delete fields[key];
  }

  // Naam en ID horen bij elkaar; zo niet, dan geldt de naam (het model kiest
  // soms het ID van een soort die erop lijkt)
  if (input.species_name) {
    const named = findPromptSpecies(input.species_name, withGroups, language);
    if (!named) {
      warnings.push(
        `${block.name}: naam "${input.species_name}" staat niet in de lijst; ID ${fields.speciesId} aangehouden`,
      );
    } else if (fields.speciesId !== named.id) {
      if (fields.speciesId !== undefined) {
        const other = getSpecies(fields.speciesId)?.name ?? 'onbekend';
        warnings.push(
          `${block.name}: ID ${fields.speciesId} (${other}) hoort niet bij "${named.name}"; ${named.id} gebruikt`,
        );
      }
      fields.speciesId = named.id;
    }
  }

  // Een dwaalgast die niet in de prompt staat: de app zoekt de gezegde naam op.
  // Altijd onzeker, want die soort zie je zelden en spraakherkenning kent hem niet.
  // Het model laat unlisted_species soms leeg en zet de naam alleen in de
  // twijfelreden ("Gezegd: wolf (niet in de lijst)", testset 18 nov): dan die.
  const said = modelText(input.unlisted_species);
  const named = said ?? saidInReason(fields.speciesId, input.uncertain_reason);
  const vagrant = named ? findVagrant(named, withGroups, language) : undefined;
  if (vagrant) {
    fields.speciesId = vagrant.id;
    fields.uncertain = true;
    fields.uncertainReason = t('reason.vagrant', { named: named ?? '' });
  } else if (said) {
    warnings.push(`${block.name}: "${said}" niet gevonden bij de dwaalgasten`);
  }

  const candidates = toCandidates(
    block.name,
    input.candidate_species,
    warnings,
    withGroups,
    language,
  );
  if (candidates) {
    fields.candidates = candidates;
    fields.uncertain = true;
    const names = namesIn(language);
    fields.uncertainReason ??= `${candidates.map((id) => names.species(id)).join(WORDS[language].or)}?`;
  }

  if (
    fields.speciesId !== undefined &&
    !isPromptSpecies(fields.speciesId, withGroups) &&
    fields.speciesId !== vagrant?.id
  ) {
    return `${block.name}: onbekende soort-ID ${fields.speciesId}`;
  }
  // Hele getallen: het schema vraagt dat, maar het model houdt zich er niet altijd aan
  if (fields.count !== undefined && (!Number.isInteger(fields.count) || fields.count < 1)) {
    return `${block.name}: ongeldig aantal ${fields.count}`;
  }
  if (input.add_count !== undefined && !Number.isInteger(input.add_count)) {
    return `${block.name}: ongeldig aantal erbij ${input.add_count}`;
  }
  // De soort waar gedrag, methode en kleed bij moeten passen: de nieuwe soort,
  // of bij een aanpassing zonder soort die van de waarneming waar het om gaat
  const target = input.ref !== undefined ? context[input.ref - 1] : undefined;
  const codesSpeciesId = fields.speciesId ?? target?.speciesId;
  if (
    (fields.sex !== undefined && fields.sex !== 'male' && fields.sex !== 'female') ||
    !validCode(countingMethods, fields.countingMethodId) ||
    !(withGroups
      ? fitCodes(block.name, fields, codesSpeciesId, warnings)
      : validCode(activities, fields.activityId) &&
        validCode(methods, fields.methodId) &&
        validCode(lifeStages, fields.lifeStageId))
  ) {
    return `${block.name}: ongeldige code`;
  }

  if (block.name === 'add_observation') {
    if (fields.speciesId === undefined || fields.count === undefined) {
      return 'add_observation: soort of aantal ontbreekt';
    }
    return { type: 'add', fields: { ...fields, speciesId: fields.speciesId, count: fields.count } };
  }

  if (!target) return `${block.name}: verwijzing #${input.ref} bestaat niet`;

  if (block.name === 'delete_observation') {
    return { type: 'delete', observationId: target.id };
  }
  if (block.name === 'update_observation') {
    return { type: 'update', observationId: target.id, fields, addCount: input.add_count };
  }
  return `onbekende tool ${block.name}`;
}
