import type Anthropic from '@anthropic-ai/sdk';
import { createMessage, type Timing } from './api';
import type { Observation } from './db';
import {
  activities,
  aliases,
  codeName,
  countingMethods,
  getSpecies,
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
}

export type Action =
  | { type: 'add'; fields: ObservationFields & { speciesId: number; count: number } }
  | { type: 'update'; observationId: string; fields: ObservationFields; addCount?: number }
  | { type: 'delete'; observationId: string }
  | { type: 'undo' };

export interface Interpretation {
  actions: Action[];
  /** Tool calls die niet geldig waren (onbekende soort, verkeerde verwijzing) */
  rejected: string[];
  /** Volledige respons van de API, bewaard voor de testset */
  response: Anthropic.Message;
  /** De recente waarnemingen zoals het model ze kreeg */
  context: string;
  timing: Timing;
}

// ---------------------------------------------------------------------------
// Tools

const enumOf = (codes: Code[]) => codes.map((c) => c.id);

/** Velden die zowel bij toevoegen als bij aanpassen kunnen. */
const fieldProperties = {
  species_id: {
    type: 'integer',
    description: 'ID uit de soortenlijst in de systeemprompt.',
  },
  count: { type: 'integer', description: 'Aantal individuen, minimaal 1.' },
  counting_method_id: { type: 'integer', enum: enumOf(countingMethods) },
  activity_id: { type: 'integer', enum: enumOf(activities) },
  method_id: { type: 'integer', enum: enumOf(methods) },
  life_stage_id: { type: 'integer', enum: enumOf(lifeStages) },
  sex: { type: 'string', enum: ['male', 'female'] },
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
      'Opmerking of opdracht van de gebruiker bij deze waarneming, bv. "bij thuiskomst terugluisteren". Kort, in de woorden van de gebruiker. Bij update_observation vervangt dit de bestaande opmerking.',
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
      // Gedrag en methode verplicht: optionele velden laat het model te snel weg
      required: [
        'species_id',
        'count',
        'counting_method_id',
        'activity_id',
        'method_id',
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
];

// ---------------------------------------------------------------------------
// Systeemprompt: vast, zodat hij gecachet kan worden

const codeList = (codes: Code[]) => codes.map((c) => `${c.id} ${c.name}`).join('; ');

const SYSTEM_PROMPT = `Je bent de interpretatielaag van Thijsse, een app waarmee een vogelaar tijdens een wandeling waarnemingen inspreekt. Je krijgt de tekst van één uitspraak, meestal uit spraakherkenning (dus met mogelijke verhaspelingen), plus de recente waarnemingen van deze wandeling. Je antwoordt uitsluitend met tool calls; de app voert ze uit. Je kunt niets terugvragen.

## Wat je doet

- Nieuwe waarneming(en) → add_observation, één per soort. "Zes houtduiven en een vink" zijn twee aanroepen.
- Correctie op iets eerders → update_observation of delete_observation, met het nummer (ref) uit de lijst met recente waarnemingen. Zonder nadere aanduiding gaat het om #1, de meest recente. "Nee, keep in plaats van vink" slaat op de meest recente vink.
- "Nog drie erbij" → update_observation met add_count 3 op de bedoelde (meestal meest recente) waarneming.
- "Ongedaan maken", "terug", "dat was fout" → undo.
- Bevestiging ("ja, klopt", "dat was goed", "vorige is correct") → update_observation op #1 met alleen uncertain: false, als #1 onzeker is. Is #1 niet onzeker, roep dan geen tool aan.
- Geen waarneming of correctie in de uitspraak (gepraat, "hallo", "test", vragen) → roep geen enkele tool aan.
- Het woord "Thijsse" aan het begin is de aanspreekvorm van de app; negeer het.

## Opmerkingen

Zegt de gebruiker iets over een waarneming dat niet in de andere velden past, zoals een opdracht voor later ("bij thuiskomst terugluisteren", "foto checken") of een bijzonderheid ("met ring", "zat op het hek"), zet dat dan in remarks. Hoort het bij een eerdere waarneming ("die heb ik op de foto"), gebruik dan update_observation. Heeft die al een opmerking (zie de lijst), herhaal die dan en voeg de nieuwe toe. Zet geen twijfel in remarks; daarvoor is uncertain_reason.

## Soorten

Gebruik alleen een ID uit de soortenlijst hieronder; verzin nooit een ID. Spraakherkenning maakt fouten: kies de soort die het meest waarschijnlijk bedoeld is en zet dan uncertain op true met een korte reden. Algemene namen ("een meeuw", "een eend") → de verzamelsoort ("Meeuw onbekend", "Eend onbekend") als die bestaat. Is de soort echt niet te bepalen, maar is er duidelijk wel een vogel gezien, kies dan de best passende verzamelsoort met uncertain ("een vogel" → Vogel onbekend).

Vogelaars gebruiken veel bijnamen en afkortingen; zie de lijst met bijnamen hieronder. Die gelden ook in verbogen vormen en verkleinwoorden ("twee pimmetjes", "drie tova's") en als spraakherkenning ze iets anders schrijft ("robo tap", "ka be vee"). Vaste afspraken:
- "Kraai" is altijd Zwarte Kraai, tenzij er uitdrukkelijk "bonte kraai" gezegd wordt. Niet Kraai onbekend.
- "Phylloscopus", "phylloscoop" → Tjiftjaf of Fitis, zonder uncertain: de gebruiker corrigeert zelf als het een bijzondere boszanger was.

## Aantal en telmethode

- Een getal → count, telmethode 2 (exact aantal). Geen getal → 1, telmethode 2.
- "Ongeveer", "zo'n", "een stuk of", "een paar" → telmethode 6 (schatting). "Een paar" ≈ 3; "een paartje" = 2, exact.
- "Groep" of "zwerm" zonder getal → count 1, telmethode 3 (gezien, niet geteld), uncertain.

## Activiteit en methode

- "overvliegend", "over", "trekkend" → activiteit 6, methode 48 (gezien). Met windrichting ("naar het zuiden") de bijbehorende overvliegend-code.
- "roepje", "roept", "roepend" → activiteit 3, methode 49 (gehoord).
- "zingend", "zang", "zingt" → activiteit 4, methode 49.
- "alarmerend", "alarm" → activiteit 25, methode 49.
- "foeragerend", "zoekt voedsel" → activiteit 2, methode 48.
- "gezien en gehoord" → methode 51.
- Niets genoemd → activiteit 1 (ter plaatse), methode 48 (gezien).
- Let ook op bijvoeglijke vormen: "zes overvliegende houtduiven" = activiteit 6, "een zingende merel" = activiteit 4.

Codes:
- Activiteit: ${codeList(activities)}
- Methode: ${codeList(methods)}
- Kleed/leeftijd: ${codeList(lifeStages)}
- Telmethode: ${codeList(countingMethods)}
- Geslacht: "man", "mannetje" → male; "vrouw", "vrouwtje" → female.

## Twijfel

Twijfel je over soort, aantal of welke waarneming bedoeld wordt, voer dan de meest waarschijnlijke actie uit met uncertain: true en een korte uncertain_reason. Liever een onzekere waarneming dan geen.

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
    codeName(activities, obs.activityId),
    codeName(methods, obs.methodId),
    codeName(lifeStages, obs.lifeStageId),
    obs.sex === 'male' ? 'man' : obs.sex === 'female' ? 'vrouw' : undefined,
    obs.uncertain ? 'onzeker' : undefined,
    obs.remarks ? `opmerking: "${obs.remarks}"` : undefined,
  ];
  return `${timeFormat.format(obs.observedAt)} ${parts.filter(Boolean).join(', ')}`;
}

/**
 * @param transcript De uitspraak als tekst
 * @param recent Recente waarnemingen van de wandeling, nieuwste eerst
 */
export async function interpret(
  transcript: string,
  recent: Observation[],
): Promise<Interpretation> {
  const context = recent.slice(0, CONTEXT_SIZE);
  const contextText = context.length
    ? context.map((obs, i) => `#${i + 1} ${describe(obs)}`).join('\n')
    : '(nog geen waarnemingen)';

  const { data: response, timing } = await createMessage<Anthropic.Message>({
    model: MODEL,
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

  const actions: Action[] = [];
  const rejected: string[] = [];
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;
    const result = toAction(block, context);
    if (typeof result === 'string') rejected.push(result);
    else actions.push(result);
  }
  return { actions, rejected, response, context: contextText, timing };
}

// ---------------------------------------------------------------------------
// Validatie: het model kan zich vergissen, de app vertrouwt niets blind

interface RawFields {
  ref?: number;
  species_id?: number;
  count?: number;
  add_count?: number;
  counting_method_id?: number;
  activity_id?: number;
  method_id?: number;
  life_stage_id?: number;
  sex?: 'male' | 'female';
  uncertain?: boolean;
  uncertain_reason?: string;
  remarks?: string;
}

const validCode = (codes: Code[], id: number | undefined) =>
  id === undefined || codes.some((c) => c.id === id);

/** Geeft een actie terug, of een omschrijving van wat er mis was. */
function toAction(block: Anthropic.ToolUseBlock, context: Observation[]): Action | string {
  const input = block.input as RawFields;

  if (block.name === 'undo') return { type: 'undo' };

  const fields: ObservationFields = {
    speciesId: input.species_id,
    count: input.count,
    countingMethodId: input.counting_method_id,
    activityId: input.activity_id,
    methodId: input.method_id,
    lifeStageId: input.life_stage_id,
    sex: input.sex,
    uncertain: input.uncertain,
    uncertainReason: input.uncertain ? input.uncertain_reason : undefined,
    remarks: input.remarks?.trim() || undefined,
  };
  // Weglaten wat het model niet meegaf, zodat een update alleen wijzigt wat bedoeld is
  for (const key of Object.keys(fields) as (keyof ObservationFields)[]) {
    if (fields[key] === undefined) delete fields[key];
  }

  if (fields.speciesId !== undefined && !getSpecies(fields.speciesId)) {
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
