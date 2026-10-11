import type Anthropic from '@anthropic-ai/sdk';
import { createMessage, type Timing } from './api';
import type { Observation } from './db';
import {
  activities,
  aliases,
  allActivities,
  allLifeStages,
  allMethods,
  codeName,
  countingMethods,
  getSpecies,
  findPromptSpecies,
  isPromptSpecies,
  lifeStages,
  methods,
  species,
  type Code,
} from './vocab';

// Zet een uitgesproken (of getypte) uitspraak om in acties. Het model krijgt
// een vaste systeemprompt met de soortenlijst (gecachet) en per aanroep de
// laatste waarnemingen van de wandeling, zodat "die", "de vorige" en "nog drie"
// werken. Het antwoordt alleen met tool calls; de app voert ze uit.

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
}

export type Action =
  | { type: 'add'; fields: ObservationFields & { speciesId: number; count: number } }
  | { type: 'update'; observationId: string; fields: ObservationFields; addCount?: number }
  | { type: 'delete'; observationId: string }
  | { type: 'undo' }
  | { type: 'dev_note' };

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
// Tools

const enumOf = (codes: Code[]) => codes.map((c) => c.id);

/** Velden die zowel bij toevoegen als bij aanpassen kunnen. */
const fieldProperties = {
  // Eerst de naam, dan het ID: met de naam vlak ervoor kiest het model minder
  // vaak het ID van een soort die erop lijkt (Boomklever 70, Boomkruiper 71)
  species_name: {
    type: 'string',
    description: 'Naam van de soort, precies zoals in de soortenlijst ("Boomkruiper"). Altijd samen met species_id.',
  },
  species_id: {
    type: 'integer',
    description: 'ID uit de soortenlijst in de systeemprompt.',
  },
  count: { type: 'integer', description: 'Aantal individuen, minimaal 1.' },
  counting_method_id: { type: 'integer', enum: enumOf(countingMethods) },
  activity_id: { type: 'integer', enum: enumOf(activities) },
  method_id: { type: 'integer', enum: enumOf(methods) },
  life_stage_id: {
    anyOf: [{ type: 'integer', enum: enumOf(lifeStages) }, { type: 'null' }],
    description:
      'Kleed of leeftijd als die genoemd wordt ("1kj", "juveniele", "eclips", "zomerkleed"), anders null. Zie "Kleed en leeftijd".',
  },
  sex: {
    anyOf: [{ type: 'string', enum: ['male', 'female'] }, { type: 'null' }],
    description: 'Geslacht als dat genoemd wordt ("mannetje", "vrouw"), anders null.',
  },
  uncertain: {
    type: 'boolean',
    description: 'True als je twijfelt aan soort, aantal of interpretatie.',
  },
  uncertain_reason: {
    type: 'string',
    description:
      'Alleen als uncertain true is: kort waarom je twijfelt, bv. "verstaan als vink, kan ook keep zijn".',
  },
  remarks: {
    type: 'string',
    description:
      'Bijzonderheid over de vogel die mee mag naar waarneming.nl, bv. "met ring", "zat op het hek". Kort, in de woorden van de gebruiker. Bij update_observation vervangt dit de bestaande opmerking.',
  },
  private_note: {
    type: 'string',
    description:
      'Notitie van de gebruiker voor zichzelf, voor het nalopen thuis, bv. "bij thuiskomst terugluisteren", "locatie klopt niet, zat verderop". Kort, in de woorden van de gebruiker. Bij update_observation vervangt dit de bestaande notitie.',
  },
} as const;

const refProperty = {
  type: 'integer',
  description: 'Nummer van de waarneming in de lijst met recente waarnemingen (#1 = meest recent).',
} as const;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_observation',
    description: 'Legt een nieuwe waarneming vast. Eén aanroep per soort.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: fieldProperties,
      // Gedrag, methode, kleed en geslacht verplicht: optionele velden laat het
      // model te snel weg. Kleed en geslacht zijn null als ze niet genoemd worden.
      required: [
        'species_name',
        'species_id',
        'count',
        'counting_method_id',
        'activity_id',
        'method_id',
        'life_stage_id',
        'sex',
        'uncertain',
      ],
      additionalProperties: false,
    },
  },
  {
    name: 'update_observation',
    description:
      'Past een eerdere waarneming aan, bv. bij "nee, keep in plaats van vink" of "nog drie erbij". Geef alleen de velden mee die veranderen.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        ref: refProperty,
        ...fieldProperties,
        add_count: {
          type: 'integer',
          description:
            'Tel dit op bij het bestaande aantal ("nog drie erbij" = 3, "twee minder" = -2).',
        },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_observation',
    description:
      'Verwijdert een eerdere waarneming, bv. bij "die laatste weg" of "schrap de vink".',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { ref: refProperty },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'undo',
    description:
      'Draait de vorige uitspraak volledig terug, bij "ongedaan maken", "terug" of "dat was fout".',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_dev_note',
    description:
      'Bewaart de uitspraak als dev note: een opmerking over de app zelf in plaats van over vogels.',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

// ---------------------------------------------------------------------------
// Systeemprompt: vast, zodat hij gecachet kan worden

const codeList = (codes: Code[]) => codes.map((c) => `${c.id} ${c.name}`).join('; ');

const SYSTEM_PROMPT = `Je bent de interpretatielaag van Fluistervink, een app waarmee een vogelaar tijdens een wandeling waarnemingen inspreekt. Je krijgt de tekst van één uitspraak, meestal uit spraakherkenning (dus met mogelijke verhaspelingen), plus de recente waarnemingen van deze wandeling. Je antwoordt uitsluitend met tool calls; de app voert ze uit. Je kunt niets terugvragen.

## Wat je doet

- Nieuwe waarneming(en) → add_observation, één per soort. "Zes houtduiven en een vink" zijn twee aanroepen.
- Eén uitspraak kan meerdere dingen tegelijk bevatten: nieuwe waarnemingen én correcties op eerdere. Voer ze allemaal uit. "Buizerd overvliegend west, en die ruigpoot van daarnet mag weg" = add_observation (Buizerd) + delete_observation.
- Correctie op iets eerders → update_observation of delete_observation, met het nummer (ref) uit de lijst met recente waarnemingen. Zonder nadere aanduiding gaat het om #1, de meest recente. "Nee, keep in plaats van vink" slaat op de meest recente vink.
- "Nog drie erbij" → update_observation met add_count 3 op de bedoelde (meestal meest recente) waarneming.
- "Ongedaan maken", "terug", "dat was fout" → undo.
- Bevestiging ("ja, klopt", "dat was goed", "vorige is correct") → update_observation op #1 met alleen uncertain: false, als #1 onzeker is. Is #1 niet onzeker, roep dan geen tool aan.
- Een opmerking over de app zelf (wat beter kan, wat niet werkt, een idee voor een functie), ook zonder "dev note" ervoor → add_dev_note. Bijvoorbeeld "bij grote groepen wil ik een schatting kunnen opgeven" of "hij trilt niet".
- Geen waarneming, correctie of opmerking over de app (gepraat, "hallo", "test", vragen) → roep geen enkele tool aan.
- Het woord "Fluistervink" (of het oude "Thijsse") aan het begin is de aanspreekvorm van de app; negeer het. Het is géén waarneming van een vink: "Fluistervink, zes houtduiven" gaat alleen over houtduiven.

## Opmerkingen

Zegt de gebruiker iets over een waarneming dat niet in de andere velden past, zet dat dan in een van twee velden:
- private_note: een notitie voor zichzelf, om thuis na te lopen. Opdrachten voor later ("bij thuiskomst terugluisteren", "foto checken", "determinatie nakijken") en opmerkingen over de locatie ("zat verderop in een boom", "locatie aanpassen"). Gaat niet naar waarneming.nl.
- remarks: een bijzonderheid over de vogel zelf, die mee mag naar waarneming.nl ("met ring", "zat op het hek", "in gezelschap van spreeuwen").
Bevat een uitspraak allebei, verdeel het dan: "zat verderop in een boom, met een ring" → private_note "zat verderop in een boom" en remarks "met ring". Laat niets weg: elke bijzonderheid die de gebruiker noemt, komt in een van de twee velden. Bij twijfel tussen de twee: private_note. Hoort het bij een eerdere waarneming ("die heb ik op de foto"), gebruik dan update_observation. Heeft die al een opmerking of notitie (zie de lijst), herhaal die dan en voeg de nieuwe toe. Zet geen twijfel over de soort in deze velden; daarvoor is uncertain_reason.

## Soorten

Gebruik alleen een ID uit de soortenlijst hieronder; verzin nooit een ID. Schrijf bij elke soort eerst species_name, de naam precies zoals hij in de soortenlijst staat, en dan het species_id dat in de lijst bij díe naam staat. Let op soorten met namen die op elkaar lijken (Boomkruiper en Boomklever). Spraakherkenning maakt fouten: kies de soort die het meest waarschijnlijk bedoeld is en zet dan uncertain op true met een korte reden. Algemene namen ("een meeuw", "een eend") → de verzamelsoort ("Meeuw onbekend", "Eend onbekend") als die bestaat. Is de soort echt niet te bepalen, maar is er duidelijk wel een vogel gezien, kies dan de best passende verzamelsoort met uncertain ("een vogel" → Vogel onbekend).

Noemt de gebruiker duidelijk een soort die niet in de lijst staat (een zeldzame dwaalgast, bv. "dwergaalscholver"), kies dan de best passende verzamelsoort (anders Vogel onbekend) met uncertain, en zet in uncertain_reason letterlijk de genoemde naam: "Gezegd: dwergaalscholver (niet in de lijst)". Kies dan geen andere soort die er toevallig op lijkt. De gebruiker zet de soort thuis zelf goed.

Vogelaars gebruiken veel bijnamen en afkortingen; zie de lijst met bijnamen hieronder. Die gelden ook in verbogen vormen en verkleinwoorden ("twee pimmetjes", "drie tova's") en als spraakherkenning ze iets anders schrijft ("robo tap", "ka be vee"). Vaste afspraken:
- "KBV" (klein bruin vogeltje) wordt door spraakherkenning vaak als "KPV" geschreven: dat is ook KBV → Zangvogel onbekend.
- "Kraai" is altijd Zwarte Kraai, tenzij er uitdrukkelijk "bonte kraai" gezegd wordt. Niet Kraai onbekend.
- Losse groepsnamen zonder nadere aanduiding: "kiek" → Bruine Kiekendief, "kar" → Kleine Karekiet, "zillie" of "zil" → Grote Zilverreiger, "kwik" → Witte Kwikstaart, altijd met uncertain ("alleen 'kiek' gezegd"), ook in meervoud en met een aantal ("drie zillies overvliegend", "twee kieken"). Met aanduiding ("blauwe kiek", "grote kar", "gele kwik") de genoemde soort, zonder uncertain.
- Veel eenden worden zonder "-eend" genoemd: "slob", "kuif", "krak", "tafel", "berg", "kroon", "witoog" (zie de bijnamen). "Wilde" alleen is géén bijnaam voor Wilde Eend (kan ook Wilde Zwaan zijn): kies op basis van de rest van de zin, of zet uncertain.
- "Drieteen" is altijd Drieteenstrandloper. Drieteenmeeuw alleen als er uitdrukkelijk "drieteenmeeuw" gezegd wordt.
- "Phylloscopus", "phylloscoop" → Tjiftjaf of Fitis, zonder uncertain: de gebruiker corrigeert zelf als het een bijzondere boszanger was.

## Aantal en telmethode

- Een getal → count, telmethode 2 (exact aantal). Geen getal → 1, telmethode 2.
- "Ongeveer", "zo'n", "een stuk of", "een paar", "schatting", "geschat" → telmethode 6 (schatting). "Vijfhonderd schatting" en "schatting vijfhonderd" = count 500, telmethode 6. "Een paar" ≈ 3; "een paartje" = 2, exact.
- Meerdere getallen voor dezelfde soort in één uitspraak ("vijf houtduiven overvliegend, ... nog twee houtduiven") → tel ze op in één waarneming, zonder uncertain.

## Geslacht

Een waarneming heeft één geslacht. Noemt de gebruiker aantallen mannetjes en vrouwtjes, roep add_observation dan aan voor elk geslacht apart, met sex en het aantal van dat geslacht; samen vormen ze het totaal. Zet de verdeling niet in remarks.
- "Vijf wilde eenden, twee vrouwtjes en drie mannetjes" → twee aanroepen: add_observation Wilde Eend count 3 sex male, en add_observation Wilde Eend count 2 sex female.
- Corrigeert de gebruiker zich in dezelfde uitspraak ("vier eenden, een vrouwtje en drie mannetjes, nee wacht, twee vrouwtjes en drie mannetjes"), gebruik dan alleen de laatste versie, maar nog steeds met een aanroep per geslacht.
Latere correcties gaan per geslacht: "nog een paartje erbij" of "nog een man en een vrouw erbij" → add_count 1 op het mannetje én add_count 1 op het vrouwtje. Staat er nog geen waarneming per geslacht (alleen een totaal), pas die dan aan en maak er een voor het andere geslacht bij.
- "Groep" of "zwerm" zonder getal → count 1, telmethode 3 (gezien, niet geteld), uncertain.

## Activiteit en methode

- "overvliegend", "over", "trekkend" → activiteit 6, methode 48 (gezien). Met windrichting ("naar het zuiden", "richting west", "noordwaarts") de bijbehorende overvliegend-code; ook als het woord overvliegend er niet bij staat ("buizerd richting west").
- Een windrichting die een plek aanduidt in plaats van een vliegrichting ("ten westen van hier", "aan de oostkant", "in het noorden van het veld") is géén overvliegend-code. Zo'n plek gaat in private_note.
- Een vogel die blijft rondhangen: "cirkelend", "cirkelt", "biddend", "zwevend boven …", "thermiekend" → activiteit 1 (ter plaatse), niet overvliegend; "jagend" → activiteit 30.
- "dood", "dode", "kadaver", "plukresten", "plukplaats" → activiteit 17 (vondst (dood)), methode 48. "Doodgereden", "verkeersslachtoffer" → activiteit 2016. Een vermoedelijke oorzaak ("plukplaats van een havik") gaat in remarks.
- "roepje", "roept", "roepend" → activiteit 3, methode 49 (gehoord).
- "zingend", "zang", "zingt" → activiteit 4, methode 49.
- "alarmerend", "alarm" → activiteit 25, methode 49.
- "foeragerend", "zoekt voedsel" → activiteit 2, methode 48.
- "gezien en gehoord" → methode 51.
- "nestbouw", "met nestmateriaal" → activiteit 3119. "Met voer", "voert jongen", "met voedsel in de snavel" → activiteit 3116. "Op het nest", "bezet nest" → activiteit 3051. "Pas uitgevlogen jong(en)" → activiteit 3121 en kleed 5 (juveniel).
- "ziek", "gewond" → activiteit 3144. "Slaapplaats" → activiteit 78.
- "nocmig", "op de recorder", "op de geluidsopname" → methode 588 (op geluidsrecorder), activiteit zoals gezegd (meestal 6, overvliegend).
- Niets genoemd → activiteit 1 (ter plaatse), methode 48 (gezien).
- Let ook op bijvoeglijke vormen: "zes overvliegende houtduiven" = activiteit 6, "een zingende merel" = activiteit 4.

Codes:
- Activiteit: ${codeList(activities)}
- Methode: ${codeList(methods)}
- Kleed/leeftijd: ${codeList(lifeStages)}
- Telmethode: ${codeList(countingMethods)}
- Geslacht: "man", "mannetje" → male; "vrouw", "vrouwtje" → female.

## Kleed en leeftijd

Vogelaars korten leeftijd en kleed af. Spraakherkenning schrijft ze soms als cijfers en letters ("1kj"), soms uit ("eerste kalenderjaar", "een-kaa-jee"). Wordt een leeftijd of kleed genoemd, ook als bijvoeglijk naamwoord ("drie juveniele spreeuwen", "een eclips mannetje"), vul dan altijd life_stage_id in. Wordt er niets over gezegd, laat het dan weg.
- "1kj", "eerste kalenderjaar" → 14; "2kj" → 15; "3kj" → 16; "4kj" → 72; "5kj" → 1175.
- "1w", "eerste winter", "eerstewinter" → 8; "2w", "tweede winter" → 10; "3w", "derde winter" → 62.
- "1z", "eerste zomer" → 9; "2z", "tweede zomer" → 11; "eerste najaar" → 7.
- "juv", "juveniel", "juveniele" → 5. "Ad", "adult", "adulte", "volwassen" → 2; "adult zomerkleed" → 3; "adult winterkleed" → 4. Alleen "zomerkleed" → 1101, alleen "winterkleed" → 1102.
- "subad", "subadult", "imm", "immatuur", "onvolwassen" → 6. "Pull", "pullus", "nestjong", "kuiken" → 1009. "Eclips" → 12.
- Samen met een geslacht ("een 1kj-mannetje") → life_stage_id én sex.
- Verschillende leeftijden van één soort in één uitspraak ("twee adulte en een 1kj zilvermeeuw") → één add_observation per leeftijd, zoals bij geslacht.

## Twijfel

Twijfel je over soort, aantal of welke waarneming bedoeld wordt, voer dan de meest waarschijnlijke actie uit met uncertain: true en een korte uncertain_reason. Liever een onzekere waarneming dan geen.

Twijfelt de gebruiker zelf ("klinkt als een winterkoning", "lijkt op een fitis", "volgens mij een sperwer", "ik check het even in Merlin"), dan is het tóch een waarneming: add_observation met uncertain: true en de twijfel in uncertain_reason. Niet negeren; komt er later een bevestiging ("ja, het was een winterkoning"), dan gaat de twijfel eraf. Een opdracht voor later ("thuis nog terugluisteren", "even in Merlin checken") gaat in private_note.

## Bijnamen (bijnaam → ID|naam)

${aliases.map((a) => `${a.bijnamen.join(', ')} → ${a.soort}|${a.naam}`).join('\n')}

## Soortenlijst (ID|naam)

${species.map((s) => `${s.id}|${s.name}`).join('\n')}`;

/**
 * Korte hash van systeemprompt en tools. Bij elke uitspraak bewaard, zodat
 * resultaten van verschillende promptversies uit elkaar te houden zijn.
 */
export const promptVersion: Promise<string> = crypto.subtle
  .digest('SHA-256', new TextEncoder().encode(SYSTEM_PROMPT + JSON.stringify(TOOLS)))
  .then((hash) =>
    [...new Uint8Array(hash).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  );

// ---------------------------------------------------------------------------
// Aanroep

const timeFormat = new Intl.DateTimeFormat('nl-NL', { timeStyle: 'short' });

function describe(obs: Observation): string {
  const parts = [
    `${obs.count} × ${getSpecies(obs.speciesId)?.name ?? `soort ${obs.speciesId}`}`,
    codeName(allActivities, obs.activityId),
    codeName(allMethods, obs.methodId),
    codeName(allLifeStages, obs.lifeStageId),
    obs.sex === 'male' ? 'man' : obs.sex === 'female' ? 'vrouw' : undefined,
    obs.uncertain ? 'onzeker' : undefined,
    obs.remarks ? `opmerking: "${obs.remarks}"` : undefined,
    obs.privateNote ? `notitie: "${obs.privateNote}"` : undefined,
  ];
  return `${timeFormat.format(obs.observedAt)} ${parts.filter(Boolean).join(', ')}`;
}

/**
 * Tool calls uit een antwoord van het model, gevalideerd. Los, zodat de
 * testset ook bewaarde antwoorden kan scoren.
 * @param context De recente waarnemingen zoals het model ze kreeg (#1 eerst)
 */
export function parseResponse(
  response: Anthropic.Message,
  context: Observation[],
): { actions: Action[]; rejected: string[]; warnings: string[] } {
  const actions: Action[] = [];
  const rejected: string[] = [];
  const warnings: string[] = [];
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;
    const result = toAction(block, context, warnings);
    if (typeof result === 'string') rejected.push(result);
    else actions.push(result);
  }
  return { actions, rejected, warnings };
}

/**
 * @param transcript De uitspraak als tekst
 * @param recent Recente waarnemingen van de wandeling, nieuwste eerst
 * @param options Alleen voor de testset (scripts/testset.mjs): een ander model,
 *   of de context precies zoals hij destijds was
 */
export async function interpret(
  transcript: string,
  recent: Observation[],
  options: { model?: string; contextText?: string } = {},
): Promise<Interpretation> {
  const context = recent.slice(0, CONTEXT_SIZE);
  const contextText =
    options.contextText ??
    (context.length
      ? context.map((obs, i) => `#${i + 1} ${describe(obs)}`).join('\n')
      : '(nog geen waarnemingen)');

  const { data: response, timing } = await createMessage<Anthropic.Message>({
    model: options.model ?? MODEL,
    max_tokens: 4096,
    // Weinig nadenken: snelheid telt in het veld, en de taak is eenvoudig
    output_config: { effort: 'low' },
    tools: TOOLS,
    // Tools en systeemprompt veranderen nooit; met dit cachepunt worden ze na
    // de eerste aanroep goedkoop en sneller ingelezen.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: `Recente waarnemingen in deze wandeling (#1 = meest recent):\n${contextText}\n\nUitspraak: "${transcript}"`,
      },
    ],
  } satisfies Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === 'refusal') {
    throw new Error('Het model weigerde de uitspraak te verwerken');
  }

  const { actions, rejected, warnings } = parseResponse(response, context);
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
  species_name?: string;
  species_id?: number;
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
}

const validCode = (codes: Code[], id: number | undefined) =>
  id === undefined || codes.some((c) => c.id === id);

/**
 * Geeft een actie terug, of een omschrijving van wat er mis was. Wat de app
 * zelf herstelde (soortnaam en ID die niet bij elkaar horen) komt in `warnings`.
 */
function toAction(
  block: Anthropic.ToolUseBlock,
  context: Observation[],
  warnings: string[],
): Action | string {
  const input = block.input as RawFields;

  if (block.name === 'undo') return { type: 'undo' };
  if (block.name === 'add_dev_note') return { type: 'dev_note' };

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
    remarks: input.remarks?.trim() || undefined,
    privateNote: input.private_note?.trim() || undefined,
  };
  // Weglaten wat het model niet meegaf, zodat een update alleen wijzigt wat bedoeld is
  for (const key of Object.keys(fields) as (keyof ObservationFields)[]) {
    if (fields[key] === undefined) delete fields[key];
  }

  // Naam en ID horen bij elkaar; zo niet, dan geldt de naam (het model kiest
  // soms het ID van een soort die erop lijkt)
  if (input.species_name) {
    const named = findPromptSpecies(input.species_name);
    if (!named) {
      warnings.push(`${block.name}: naam "${input.species_name}" staat niet in de lijst; ID ${fields.speciesId} aangehouden`);
    } else if (fields.speciesId !== named.id) {
      if (fields.speciesId !== undefined) {
        const other = getSpecies(fields.speciesId)?.name ?? 'onbekend';
        warnings.push(`${block.name}: ID ${fields.speciesId} (${other}) hoort niet bij "${named.name}"; ${named.id} gebruikt`);
      }
      fields.speciesId = named.id;
    }
  }

  if (fields.speciesId !== undefined && !isPromptSpecies(fields.speciesId)) {
    return `${block.name}: onbekende soort-ID ${fields.speciesId}`;
  }
  if (fields.count !== undefined && fields.count < 1) {
    return `${block.name}: ongeldig aantal ${fields.count}`;
  }
  if (
    !validCode(countingMethods, fields.countingMethodId) ||
    !validCode(activities, fields.activityId) ||
    !validCode(methods, fields.methodId) ||
    !validCode(lifeStages, fields.lifeStageId)
  ) {
    return `${block.name}: ongeldige code`;
  }

  if (block.name === 'add_observation') {
    if (fields.speciesId === undefined || fields.count === undefined) {
      return 'add_observation: soort of aantal ontbreekt';
    }
    return { type: 'add', fields: { ...fields, speciesId: fields.speciesId, count: fields.count } };
  }

  const target = input.ref !== undefined ? context[input.ref - 1] : undefined;
  if (!target) return `${block.name}: verwijzing #${input.ref} bestaat niet`;

  if (block.name === 'delete_observation') {
    return { type: 'delete', observationId: target.id };
  }
  if (block.name === 'update_observation') {
    return { type: 'update', observationId: target.id, fields, addCount: input.add_count };
  }
  return `onbekende tool ${block.name}`;
}
