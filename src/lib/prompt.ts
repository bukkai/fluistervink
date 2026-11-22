import type Anthropic from '@anthropic-ai/sdk';
import type { Language } from './i18n';
import { buildEnglishPrompt, englishTools } from './promptEn';
import { DIRECTIONS } from './spokenPlace';
import {
  activities,
  aliases,
  aliasesOf,
  heardNames,
  BIRDS,
  countingMethods,
  groups,
  insectGroups,
  insectsEnabled,
  lifeStages,
  methods,
  promptSpeciesOf,
  species,
  type Code,
} from './vocab';

// Wat het model vast meekrijgt: de tools en de systeemprompt met de
// soortenlijst. Vast per variant (met of zonder de andere soortgroepen), zodat
// ze gecachet kunnen worden; elke wijziging geeft een nieuwe promptversie.
// De aanroep en de controle van het antwoord staan in interpret.ts.

// ---------------------------------------------------------------------------
// Tools

const enumOf = (codes: Code[]) => codes.map((c) => c.id);

/** Velden die zowel bij toevoegen als bij aanpassen kunnen. */
const fieldProperties = {
  // Eerst de naam, dan het ID: met de naam vlak ervoor kiest het model minder
  // vaak het ID van een soort die erop lijkt (Boomklever 70, Boomkruiper 71)
  species_name: {
    type: 'string',
    description:
      'Nederlandse naam van de soort, precies zoals in de soortenlijst ("Boomkruiper"), ook als de gebruiker de wetenschappelijke naam zei. Altijd samen met species_id.',
  },
  species_id: {
    type: 'integer',
    description: 'ID uit de soortenlijst in de systeemprompt.',
  },
  unlisted_species: {
    type: 'string',
    description:
      'Alleen als de gebruiker duidelijk een soort noemt die niet in de soortenlijst staat (een zeldzame dwaalgast): de naam zoals gezegd, bv. "roodkopklauwier". species_name en species_id zijn dan de best passende verzamelsoort, anders Vogel onbekend. Zie "Soorten".',
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
      'Notitie van de gebruiker voor zichzelf, voor het nalopen thuis, bv. "bij thuiskomst terugluisteren", "foto checken". Kort, in de woorden van de gebruiker. Bij update_observation vervangt dit de bestaande notitie.',
  },
  place_description: {
    type: 'string',
    description:
      'Alleen als de vogel niet bij de gebruiker is en die zegt waar: de plek in de woorden van de gebruiker, bv. "aan de overkant van de rivier", "500 m zuid van hier". Zie "Plek".',
  },
  place_distance_m: {
    anyOf: [{ type: 'integer' }, { type: 'null' }],
    description:
      'Alleen samen met place_description: afstand van de gebruiker tot de vogel in meters, als die genoemd wordt ("halve kilometer" = 500), anders null.',
  },
  place_direction: {
    anyOf: [{ type: 'string', enum: Object.keys(DIRECTIONS) }, { type: 'null' }],
    description:
      'Alleen samen met place_description: windrichting van de vogel gezien vanaf de gebruiker, als die genoemd wordt, anders null.',
  },
} as const;

/** Twijfel tussen bepaalde soorten ("fitis of tjiftjaf"), voor iedereen sinds 16 nov */
const candidateProperty = {
  candidate_species: {
    anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }],
    description:
      'Alleen bij twijfel tussen twee of drie bepaalde soorten: hun namen precies zoals in de soortenlijst, bv. ["Fitis", "Tjiftjaf"], anders null. Zie "Twijfel".',
  },
} as const;

/**
 * Anthropic weigert strikte tools met samen meer optionele velden dan dit
 * (400 "too many optional parameters"). Zonder kandidaten zaten we er precies
 * op; daarom is candidate_species verplicht (null als er geen twijfel is) en
 * alleen in add_observation. Een test bewaakt de grens.
 */
export const MAX_OPTIONAL_PARAMETERS = 24;

/** Hooguit zoveel kandidaten; meer is geen twijfel tussen soorten maar een groep */
export const MAX_CANDIDATES = 3;

/** Groepen naast vogels (keuze 'soortgroepen' bij Instellingen) */
const otherGroups = groups.filter((g) => g.id !== BIRDS);

/**
 * Codes van alle groepen samen, voor het schema; de app controleert per groep.
 * `insects`: ook die van de insectengroepen (docs/plan-insecten.md).
 */
const allGroupCodes = (field: 'activities' | 'methods' | 'lifeStages', insects: boolean) =>
  [...groups, ...(insects ? insectGroups : [])].flatMap((g) => g.codes[field]);

/**
 * Velden met de andere soortgroepen erbij: de codes van alle groepen, en een
 * verzamelsoort van de groep bij een onbekend dier. Zelfde volgorde van de
 * sleutels, zodat de tools zonder de optie precies gelijk blijven.
 */
const fieldPropertiesWithGroups = (insects: boolean) =>
  ({
    ...fieldProperties,
    unlisted_species: {
      type: 'string',
      description: insects
        ? 'Alleen als de gebruiker duidelijk een soort noemt die niet in de soortenlijst staat (een zeldzame dwaalgast, een zeldzaam ander dier of een insect met een soortnaam): de naam zoals gezegd, bv. "roodkopklauwier", "wolf" of "aardhommel". species_name en species_id zijn dan de best passende verzamelsoort van zijn groep (Vogel onbekend, Zoogdier onbekend, Hommel onbekend, enz.). Zie "Soorten", "Andere dieren" en "Insecten".'
        : 'Alleen als de gebruiker duidelijk een soort noemt die niet in de soortenlijst staat (een zeldzame dwaalgast of een zeldzaam ander dier): de naam zoals gezegd, bv. "roodkopklauwier" of "wolf". species_name en species_id zijn dan de best passende verzamelsoort van zijn groep (Vogel onbekend, Zoogdier onbekend, enz.). Zie "Soorten" en "Andere dieren".',
    },
    activity_id: { type: 'integer', enum: enumOf(allGroupCodes('activities', insects)) },
    method_id: { type: 'integer', enum: enumOf(allGroupCodes('methods', insects)) },
    life_stage_id: {
      ...fieldProperties.life_stage_id,
      anyOf: [
        { type: 'integer', enum: enumOf(allGroupCodes('lifeStages', insects)) },
        { type: 'null' },
      ],
    },
  }) as const;

const refProperty = {
  type: 'integer',
  description: 'Nummer van de waarneming in de lijst met recente waarnemingen (#1 = meest recent).',
} as const;

/**
 * Zet de verplichte velden vooraan, in de volgorde van `required`. Stond een
 * verplicht veld (candidate_species) achter de optionele, dan liet het model
 * die optionele velden weg: geen plek meer bij een nieuwe waarneming (sinds
 * 12 nov), en in een trektelstuk stopte het na een gezegde plek helemaal, met
 * de soorten daarna kwijt (feedback 16 nov). Een test bewaakt de volgorde.
 */
function requiredFirst<T extends Record<string, unknown>>(properties: T, required: string[]) {
  const sorted: Record<string, unknown> = {};
  for (const key of required) sorted[key] = properties[key];
  return { ...sorted, ...properties } as T;
}

/** Verplicht bij add_observation, in deze volgorde */
const addRequired = [
  'species_name',
  'species_id',
  'count',
  'counting_method_id',
  'activity_id',
  'method_id',
  'life_stage_id',
  'sex',
  'uncertain',
  'candidate_species',
];

const buildTools = (withGroups: boolean, insects = false): Anthropic.Tool[] => {
  const fields = withGroups ? fieldPropertiesWithGroups(insects) : fieldProperties;
  const properties = requiredFirst({ ...fields, ...candidateProperty }, addRequired);
  return [
    {
      name: 'add_observation',
      description: 'Legt een nieuwe waarneming vast. Eén aanroep per soort.',
      strict: true,
      input_schema: {
        type: 'object',
        properties,
        // Gedrag, methode, kleed en geslacht verplicht: optionele velden laat het
        // model te snel weg. Kleed en geslacht zijn null als ze niet genoemd worden.
        required: addRequired,
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
          ...fields,
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
      name: 'redo',
      description:
        'Zet terug wat de laatste undo terugdraaide, bij "toch niet ongedaan maken" of "zet terug wat je net ongedaan maakte".',
      strict: true,
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'add_dev_note',
      description:
        'Bewaart een opmerking over de app zelf als feedback. Alleen als de gebruiker er "feedback" (of "dev note") bij zegt.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description:
              'Alleen de opmerking over de app, in de woorden van de gebruiker, zonder "feedback" ervoor en zonder de waarnemingen eromheen.',
          },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  ];
};

// ---------------------------------------------------------------------------
// Systeemprompt: vast, zodat hij gecachet kan worden

const codeList = (codes: Code[]) => codes.map((c) => `${c.id} ${c.name}`).join('; ');

const CANDIDATE_RULES = `

Twijfel je tussen twee of drie bepaalde soorten (de gebruiker zegt "fitis of tjiftjaf", "kleine of grote zilverreiger", of de spraakherkenning laat twee soorten open), zet die dan bij add_observation in candidate_species, met de namen precies zoals in de soortenlijst, en uncertain: true. Kies voor species_name dan de verzamelsoort die precies die soorten omvat als die in de lijst staat ("Tjiftjaf of Fitis", "Wilde of Kleine Zwaan"), anders de meest waarschijnlijke kandidaat. Zet candidate_species op null als je maar één soort in gedachten hebt, en bij een hele groep ("een meeuw" → Meeuw onbekend, zonder kandidaten). Kiest de gebruiker later ("het was een fitis"), dan update_observation met die soort en uncertain: false.`;

/** Codes van een groep, zoals onder "Codes" voor vogels */
const groupCodeLines = (g: (typeof groups)[number]) =>
  `### ${g.name}
- Activiteit: ${codeList(g.codes.activities)}
- Methode: ${codeList(g.codes.methods)}
- Kleed/leeftijd: ${codeList(g.codes.lifeStages)}`;

const GROUP_RULES = `

## Andere dieren

Naast vogels spreekt de gebruiker ook zoogdieren, reptielen en amfibieën, dagvlinders en libellen in. Die staan in de soortenlijst onder een eigen kopje. Elke groep heeft eigen codes voor activiteit, methode en kleed (hieronder): gebruik bij een soort alleen de codes van zijn eigen groep, nooit die van vogels. Niets genoemd → ter plaatse en gezien van die groep. Aantal, telmethode, geslacht, plek, opmerkingen en twijfel werken net als bij vogels.

- Namen die op een vogel lijken: "koevinkje" is een dagvlinder, geen vink. "Kleine vos" en "grote vos" zijn dagvlinders; alleen "vos" is het zoogdier. Ook "atalanta", "dagpauwoog", "groentje", "landkaartje" en "hooibeestje" zijn dagvlinders.
- "Das", "ree", "haas", "mol" en "pad" zijn ook gewone woorden. Gaat de zin niet over een dier, roep dan geen tool aan. Is het wel een waarneming maar twijfel je aan de soort, dan uncertain.
- Een dier dat niet in de lijst staat → de verzamelsoort van zijn groep ("Zoogdier onbekend", "Vleermuis onbekend", "Kikker/pad onbekend", "Hagedis onbekend", "Dagvlinder onbekend", "Libel onbekend"), met uncertain en de gezegde naam in uncertain_reason. Is het een echte soortnaam (een zeldzaam dier als "wolf", "knoflookpad", "goudjakhals"), zet die naam dan ook in unlisted_species, net als bij een dwaalgast: de app zoekt de soort zelf op. "Korenwolf" is de Europese hamster, een zoogdier, geen vogel.
- Vleermuizen: "op de batdetector", "met de detector" → methode batdetector.
- Sporen van zoogdieren: "prenten", "pootafdrukken" → methode prenten; "keutels", "uitwerpselen" → uitwerpselen; "vraatsporen" → vraatsporen. Activiteit ter plaatse.
- Libellen: "paring", "paringswiel", "in copula" → in copula; "tandem" → tandem; "eileggend", "eiafzettend" → eileggend; "uitsluipend" → vervellend.
- Vlinders en libellen: "rups", "pop", "ei", "larve", "larvenhuidje", "net uitgeslopen" → het kleed van die groep ("net uitgeslopen" → imago, niet uitgekleurd).
- Trekkende vlinders met windrichting ("atalanta's trekkend zuid") → langstrekkend met die richting.
- Doodgereden → slachtoffer verkeer; dood gevonden → dood.

${otherGroups.map(groupCodeLines).join('\n\n')}`;

/**
 * Insecten (docs/plan-insecten.md, laag 1): alleen verzamelsoorten in de lijst;
 * een soortnaam zoekt de app op in de groep van de gekozen verzamelsoort
 * (`findInsect` in vocab.ts, via unlisted_species).
 */
const INSECT_RULES = `

## Insecten

De gebruiker spreekt soms ook een insect in: een kever, wants, hommel, bij, wesp, mier, nachtvlinder, mot, sprinkhaan, krekel of zweefvlieg. Daarvan staan alleen verzamelsoorten in de soortenlijst, onder "Insecten".
- Een insect zonder soortnaam ("een hommel", "twee wespen", "een lieveheersbeestje", "een mot") → die verzamelsoort, zonder uncertain.
- Een insect met een soortnaam ("een aardhommel", "een vliegend hert", "een kolibrievlinder", "een groene stinkwants", "een blinde bij") → de verzamelsoort van zijn groep, met de naam zoals gezegd in unlisted_species, uncertain, en in uncertain_reason letterlijk "Gezegd: aardhommel (niet in de lijst)". De app zoekt de soort zelf op in de lijst van die groep, dus de groep moet kloppen:
  - hommel → Hommel onbekend; bij, honingbij, zandbij → Bij onbekend; wesp, hoornaar → Wesp onbekend; mier → Mier onbekend;
  - kever, boktor, loopkever, tor, haantje (de kever) → Kever onbekend; lieveheersbeestje → Lieveheersbeestje onbekend; meikever, junikever → Meikever onbekend;
  - wants, cicade, schuimbeestje → Wants onbekend; schildwants, stinkwants → Schildwants onbekend;
  - nachtvlinder, uil, spanner, pijlstaart, beer (de vlinder), een rups van een nachtvlinder → Nachtvlinder onbekend; mot, microvlinder, vedermot → Mot onbekend (microvlinder);
  - sprinkhaan, krekel, veenmol → Sprinkhaan onbekend; zweefvlieg, blinde bij → Zweefvlieg onbekend.
- Namen die op een vogel lijken: zegt de gebruiker dat het om een insect gaat ("goudhaantje, de kever, niet de vogel", "een rietvink, de nachtvlinder"), dan is het een insect: de verzamelsoort van die groep met de naam in unlisted_species. Zonder zo'n aanwijzing is een vogelnaam een vogel: "een goudhaantje" is de Goudhaan.
- Dagvlinders en libellen zijn geen insecten in deze zin: die staan gewoon in de lijst (zie "Andere dieren"). Een dier dat hier en daar niet bij hoort (een spin, een mug, een gewone vlieg) → roep geen tool aan.
- Codes: elke insectengroep heeft eigen codes (hieronder); gebruik alleen die van de groep van de soort. Niets genoemd → ter plaatse en gezien van die groep. "Rups" → kleed rups, "larve" → larve/nimf, "pop" → pop. "Op het laken", "op de lamp" → op licht. Een zingende of tsjirpende sprinkhaan of krekel → baltsend / zingend, methode gehoord.

${insectGroups.map(groupCodeLines).join('\n\n')}`;

const speciesLines = (list: typeof species) =>
  list.map((s) => `${s.id}|${s.name}|${s.scientific}`).join('\n');

const aliasLines = (list: typeof aliases) =>
  list.map((a) => `${heardNames(a).join(', ')} → ${a.soort}|${a.naam}`).join('\n');

const buildPrompt = (
  withGroups: boolean,
  insects = false,
) => `Je bent de interpretatielaag van Fluistervink, een app waarmee een vogelaar tijdens het vogelen waarnemingen inspreekt. Je krijgt de tekst van één uitspraak, meestal uit spraakherkenning (dus met mogelijke verhaspelingen), plus de recente waarnemingen van deze sessie. Je antwoordt uitsluitend met tool calls; de app voert ze uit. Je kunt niets terugvragen.

## Wat je doet

- Nieuwe waarneming(en) → add_observation, één per soort. "Zes houtduiven en een vink" zijn twee aanroepen.
- Eén uitspraak kan meerdere dingen tegelijk bevatten: nieuwe waarnemingen én correcties op eerdere. Voer ze allemaal uit. "Buizerd overvliegend west, en die ruigpoot van daarnet mag weg" = add_observation (Buizerd) + delete_observation.
- Correctie op iets eerders → update_observation of delete_observation, met het nummer (ref) uit de lijst met recente waarnemingen. Zonder nadere aanduiding gaat het om #1, de meest recente. "Nee, keep in plaats van vink" slaat op de meest recente vink.
- Verwijzing naar een eerdere waarneming ("die X van net", "de X van zojuist", "die X van daarnet") → update_observation op die waarneming, nooit een nieuwe waarneming. Bij een onzekere waarneming staat in de lijst wat er gezegd is ("onzeker (Gezegd: hulpen, opgevat als Huismus)"); "die hulpen" verwijst dan naar die waarneming. Staat X niet in de lijst met recente waarnemingen, dan is het vrijwel altijd een verstaanfout: kies de recente waarneming waarvan de naam er het meest op lijkt en zet uncertain op true met een korte reden. "Die kei van net vloog richting west", terwijl er net een kraai was → update_observation op de kraai (overvliegend west), uncertain_reason "Gezegd: kei, opgevat als de kraai van net".
- "Nog drie erbij" → update_observation met add_count 3 op de bedoelde (meestal meest recente) waarneming.
- "Nog een X" of "nog twee X" zonder "erbij" of "bij": telt op bij de meest recente X (add_count), tenzij die volgens de lijst ver weg is ("… m hiervandaan" of "… km hiervandaan"). Dan is het een nieuwe vogel op een nieuwe plek: add_observation. Met "erbij" of "bij" ("doe er nog vier bij", "nog twee erbij") altijd add_count, ook als de vorige ver weg is.
- "Ongedaan maken", "terug", "dat was fout" → undo. Nog een keer undo gaat een stap verder terug.
- Een undo zelf terugdraaien ("toch niet ongedaan maken", "zet terug wat je net ongedaan maakte", "dat ongedaan maken was fout") → redo.
- Bevestiging ("ja, klopt", "dat was goed", "vorige is correct") → update_observation op #1 met alleen uncertain: false, als #1 onzeker is. Is #1 niet onzeker, roep dan geen tool aan.
- Feedback over de app herken je alleen aan het woord "feedback" (of "dev note", ook verhaspeld door de spraakherkenning) → add_dev_note. Zonder dat woord is het geen feedback, ook niet als het over de app gaat ("hij trilt niet"): dan geen add_dev_note.
- Feedback midden tussen waarnemingen (vooral in een trektelling, waar de app zelf stukken van een minuut knipt): voer de waarnemingen gewoon uit én roep add_dev_note aan, met in text alleen de opmerking over de app. "Zes holenduiven. Feedback, de knop is te klein. Buizerd." = add_observation (Holenduif) + add_dev_note (text "de knop is te klein") + add_observation (Buizerd).
- Geen waarneming, correctie of feedback (gepraat, "hallo", "test", vragen, opmerkingen over de app zonder "feedback") → roep geen enkele tool aan.
- Het woord "Fluistervink" (of het oude "Thijsse") aan het begin is de aanspreekvorm van de app; negeer het. Het is géén waarneming van een vink: "Fluistervink, zes houtduiven" gaat alleen over houtduiven.

## Opmerkingen

Zegt de gebruiker iets over een waarneming dat niet in de andere velden past, zet dat dan in een van twee velden:
- private_note: een notitie voor zichzelf, om thuis na te lopen. Opdrachten voor later ("bij thuiskomst terugluisteren", "foto checken", "determinatie nakijken", "locatie aanpassen"). Gaat niet naar waarneming.nl. Waar de vogel zit, als dat niet bij de gebruiker is, gaat niet hierin maar in de plekvelden (zie "Plek").
- remarks: een bijzonderheid over de vogel zelf, die mee mag naar waarneming.nl ("met ring", "zat op het hek", "in gezelschap van spreeuwen").
Bevat een uitspraak allebei, verdeel het dan: "foto checken, met een ring" → private_note "foto checken" en remarks "met ring". Laat niets weg: elke bijzonderheid die de gebruiker noemt, komt in een van de twee velden. Bij twijfel tussen de twee: private_note. Hoort het bij een eerdere waarneming ("die heb ik op de foto"), gebruik dan update_observation. Heeft die al een opmerking of notitie (zie de lijst) en komt er iets bij ("die zat ook op het hek"), herhaal die dan en voeg de nieuwe toe. Verbetert of vervangt de gebruiker de notitie of opmerking ("nee, het was ten zuiden", "pas de notitie aan", "als notitie: …"), schrijf dan alleen de nieuwe versie, zonder de oude. Zet geen twijfel over de soort in deze velden; daarvoor is uncertain_reason.

## Plek

De app legt de plek van de gebruiker vast. Zegt de gebruiker dat de vogel ergens anders is, en waar, vul dan de plekvelden. De app rekent de plek uit; je hoeft niets van de kaart te weten.
- place_description: de plek in de woorden van de gebruiker, kort ("aan de overkant van de rivier", "500 m zuid van hier", "verderop in de weilanden", "links van het pad").
- place_distance_m: de afstand in meters als die genoemd wordt ("vijfhonderd meter" = 500, "halve kilometer" = 500, "een kilometer" = 1000, "zo'n tweehonderd meter" = 200), anders null. Schat geen afstand die niet genoemd wordt.
- place_direction: de windrichting van de vogel vanaf de gebruiker als die genoemd wordt ("zuid", "ten zuiden van hier", "zuidelijk" → Z; "noordoost" → NO), anders null. "Links", "rechts", "voor me", "achter me" zijn geen windrichting: alleen in place_description.
Voorbeelden:
- "Blauwe reiger aan de overkant van de rivier" → place_description "aan de overkant van de rivier", place_distance_m null, place_direction null.
- "Buizerd overvliegend, 500 m zuid van hier" → activiteit overvliegend (zonder richting), place_description "500 m zuid van hier", place_distance_m 500, place_direction Z.
- "Buizerd overvliegend naar het zuiden" is een vliegrichting, geen plek: geen plekvelden.
Laat de plekvelden weg als de vogel bij de gebruiker is, of als het alleen gaat om waar hij zit zonder dat het een andere plek is ("zat op het hek", "in de rietkraag" → remarks). Een plek voor een eerdere waarneming ("die reiger zat eigenlijk 300 m noord") → update_observation met de plekvelden.

## Soorten

Gebruik alleen een ID uit de soortenlijst hieronder; verzin nooit een ID. Schrijf bij elke soort eerst species_name, de naam precies zoals hij in de soortenlijst staat, en dan het species_id dat in de lijst bij díe naam staat. Let op soorten met namen die op elkaar lijken (Boomkruiper en Boomklever). Spraakherkenning maakt fouten: kies de soort die het meest waarschijnlijk bedoeld is en zet dan uncertain op true met een korte reden. Algemene namen ("een meeuw", "een eend") → de verzamelsoort ("Meeuw onbekend", "Eend onbekend") als die bestaat. Is de soort echt niet te bepalen, maar is er duidelijk wel een vogel gezien, kies dan de best passende verzamelsoort met uncertain ("een vogel" → Vogel onbekend).

Noemt de gebruiker duidelijk een soort die niet in de lijst staat (een zeldzame dwaalgast, bv. "roodkopklauwier", "kuifkoekoek", "dwergaalscholver"), zet die naam dan zoals gezegd in unlisted_species, en kies voor species_name en species_id de best passende verzamelsoort (anders Vogel onbekend) met uncertain en in uncertain_reason letterlijk de genoemde naam: "Gezegd: roodkopklauwier (niet in de lijst)". De app zoekt de soort zelf op in een lijst met dwaalgasten. Kies dan geen andere soort die er toevallig op lijkt. Gebruik unlisted_species niet voor een soort die wel in de lijst staat, ook niet als die zeldzaam is.

Vogelaars gebruiken veel bijnamen en afkortingen; zie de lijst met bijnamen hieronder. Die gelden ook in verbogen vormen en verkleinwoorden ("twee pimmetjes", "drie tova's") en als spraakherkenning ze iets anders schrijft ("robo tap", "ka be vee"). Vaste afspraken:
- "KBV" (klein bruin vogeltje) wordt door spraakherkenning vaak als "KPV" geschreven: dat is ook KBV → Zangvogel onbekend.
- "Kraai" is altijd Zwarte Kraai, tenzij er uitdrukkelijk "bonte kraai" gezegd wordt. Niet Kraai onbekend.
- Losse groepsnamen zonder nadere aanduiding: "kiek" → Bruine Kiekendief, "kar" → Kleine Karekiet, "zillie" of "zil" → Grote Zilverreiger, "kwik" → Witte Kwikstaart, altijd met uncertain ("alleen 'kiek' gezegd"), ook in meervoud en met een aantal ("drie zillies overvliegend", "twee kieken"). Met aanduiding ("blauwe kiek", "grote kar", "gele kwik") de genoemde soort, zonder uncertain.
- Veel eenden worden zonder "-eend" genoemd: "slob", "kuif", "krak", "tafel", "berg", "kroon", "witoog" (zie de bijnamen). "Wilde" alleen is géén bijnaam voor Wilde Eend (kan ook Wilde Zwaan zijn): kies op basis van de rest van de zin, of zet uncertain.
- "Blako" (ook "blaco", "blakko", "blakootje") is altijd Bladkoning, nooit Blauwe Reiger: die heet "blar" of "blauwe reiger".
- "Drieteen" is altijd Drieteenstrandloper. Drieteenmeeuw alleen als er uitdrukkelijk "drieteenmeeuw" gezegd wordt.
- "Phylloscopus", "phylloscoop" → Tjiftjaf of Fitis, zonder uncertain: de gebruiker corrigeert zelf als het een bijzondere boszanger was.

Sommige vogelaars spreken de wetenschappelijke naam in ("Fringilla coelebs", "twee Anas platyrhynchos"). Die staat in de soortenlijst achter de Nederlandse naam. Spraakherkenning schrijft Latijn vaak half fout ("fringila koelebs", "anas plati rinchos"): kies de soort waarvan de wetenschappelijke naam het meest lijkt, met uncertain als het niet duidelijk is. Ook dan is species_name de Nederlandse naam uit de lijst. Alleen een geslachtsnaam ("een Larus", "Anas") → de passende verzamelsoort met uncertain, behalve Phylloscopus (zie hierboven).

## Aantal en telmethode

- Een getal → count, telmethode 2 (exact aantal). Geen getal → 1, telmethode 2.
- "Ongeveer", "zo'n", "een stuk of", "een paar", "schatting", "geschat" → telmethode 6 (schatting). "Vijfhonderd schatting" en "schatting vijfhonderd" = count 500, telmethode 6. "Een paar" ≈ 3; "een paartje" = 2, exact.
- Een bereik ("tussen de vijftig en honderd", "vijftig à honderd", "twintig, dertig") → count het midden, afgerond (75), telmethode 6, en het bereik in remarks ("50-100"). Een orde van grootte zonder getal ("enkele tientallen", "een paar honderd", "honderden", "duizenden") → telmethode 6 met een redelijke schatting: "enkele tientallen" ≈ 30, "een paar honderd" ≈ 300, "honderden" ≈ 300, "duizenden" ≈ 3000; zet de woorden van de gebruiker in remarks ("enkele honderden"). Een bereik is geen twijfel: geen uncertain.
- Meerdere getallen voor dezelfde soort in één uitspraak ("vijf houtduiven overvliegend, ... nog twee houtduiven") → tel ze op in één waarneming, zonder uncertain.
- Aantal niet geteld: "onbekend aantal", "aantal onbekend", "niet geteld", "ongeteld", "weet niet hoeveel", "veel", "een heleboel", "een hele zwerm" → count 1, telmethode 3 (gezien, niet geteld). Dat is geen twijfel over de soort: geen uncertain. "Onbekend aantal kauwtjes, alleen gehoord" = Kauw, count 1, telmethode 3, methode gehoord.
- "Groep" of "zwerm" zonder getal → count 1, telmethode 3 (gezien, niet geteld), uncertain.

## Geslacht

Een waarneming heeft één geslacht. Noemt de gebruiker aantallen mannetjes en vrouwtjes, roep add_observation dan aan voor elk geslacht apart, met sex en het aantal van dat geslacht; samen vormen ze het totaal. Zet de verdeling niet in remarks.
- "Vijf wilde eenden, twee vrouwtjes en drie mannetjes" → twee aanroepen: add_observation Wilde Eend count 3 sex male, en add_observation Wilde Eend count 2 sex female.
- Corrigeert de gebruiker zich in dezelfde uitspraak ("vier eenden, een vrouwtje en drie mannetjes, nee wacht, twee vrouwtjes en drie mannetjes"), gebruik dan alleen de laatste versie, maar nog steeds met een aanroep per geslacht.
Latere correcties gaan per geslacht: "nog een paartje erbij" of "nog een man en een vrouw erbij" → add_count 1 op het mannetje én add_count 1 op het vrouwtje. Staat er nog geen waarneming per geslacht (alleen een totaal), pas die dan aan en maak er een voor het andere geslacht bij.
- "Groepje" direct voor een soortnaam, zonder getal ("groepje merel", "groepje vink") is bijna altijd een verkeerd verstaan "roepje": één roepende vogel, zie "Activiteit en methode" (count 1, telmethode 2, niet uncertain). Alleen met een aantal ("groepje van twintig vinken", "een groepje van vijf kauwen") is het een groep.

## Activiteit en methode

- "overvliegend", "over", "trekkend" → activiteit 6, methode 48 (gezien). Met windrichting ("naar het zuiden", "richting west", "noordwaarts") de bijbehorende overvliegend-code; ook als het woord overvliegend er niet bij staat ("buizerd richting west").
- Een windrichting die een plek aanduidt in plaats van een vliegrichting ("ten westen van hier", "500 m zuid", "aan de oostkant") is géén overvliegend-code. Zo'n plek gaat in de plekvelden, zie "Plek".
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
- In een trektelling (het bericht zegt "Dit is een stuk uit een trektelling") telt de gebruiker vogels die langskomen: een vogel zonder genoemd gedrag is dan overvliegend (activiteit 6, methode 48), met windrichting de bijbehorende overvliegend-code. Noemt de gebruiker wel gedrag ("ter plaatse", "zit", "foeragerend", "cirkelend", "roepje", "zingend"), dan geldt dat, zoals hierboven. Alleen voor vogels: andere dieren blijven ter plaatse.
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

Twijfelt de gebruiker zelf ("klinkt als een winterkoning", "lijkt op een fitis", "volgens mij een sperwer", "ik check het even in Merlin"), dan is het tóch een waarneming: add_observation met uncertain: true en de twijfel in uncertain_reason. Niet negeren; komt er later een bevestiging ("ja, het was een winterkoning"), dan gaat de twijfel eraf. Een opdracht voor later ("thuis nog terugluisteren", "even in Merlin checken") gaat in private_note.${CANDIDATE_RULES}${withGroups ? GROUP_RULES : ''}${insects ? INSECT_RULES : ''}

## Bijnamen (bijnaam → ID|naam)

${aliasLines(withGroups ? [...aliases, ...otherGroups.flatMap((g) => aliasesOf(g.id))] : aliases)}

## Soortenlijst (ID|naam|wetenschappelijke naam)

${
  withGroups
    ? [
        `### Vogels\n${speciesLines(species)}`,
        ...otherGroups.map((g) => `### ${g.name}\n${speciesLines(promptSpeciesOf(g.id))}`),
        ...(insects
          ? [`### Insecten\n${speciesLines(insectGroups.flatMap((g) => promptSpeciesOf(g.id)))}`]
          : []),
      ].join('\n\n')
    : speciesLines(species)
}`;

interface Variant {
  system: string;
  tools: Anthropic.Tool[];
  version: Promise<string>;
}

const variants = new Map<string, Variant>();

/**
 * Systeemprompt en tools, met of zonder de andere soortgroepen, in de taal van
 * de uitspraak (Engels: promptEn.ts, ontwikkeloptie "English"); vast per
 * variant, dus te cachen
 */
export function variant(withGroups: boolean, language: Language = 'nl'): Variant {
  // Insecten alleen met de andere soortgroepen (ontwikkeloptie, insects.ts)
  const insects = withGroups && insectsEnabled();
  const key = `${language}:${withGroups}:${insects}`;
  let found = variants.get(key);
  if (!found) {
    const dutchTools = buildTools(withGroups, insects);
    const system =
      language === 'en'
        ? buildEnglishPrompt(withGroups, insects)
        : buildPrompt(withGroups, insects);
    const tools = language === 'en' ? englishTools(dutchTools, withGroups, insects) : dutchTools;
    const version = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(system + JSON.stringify(tools)))
      .then((hash) =>
        [...new Uint8Array(hash).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(''),
      );
    found = { system, tools, version };
    variants.set(key, found);
  }
  return found;
}

/**
 * Korte hash van systeemprompt en tools. Bij elke uitspraak bewaard, zodat
 * resultaten van verschillende promptversies uit elkaar te houden zijn.
 */
export const promptVersionFor = (withGroups = false, language: Language = 'nl') =>
  variant(withGroups, language).version;

/** De tools van een variant (voor de tests) */
export const toolsFor = (withGroups = false, language: Language = 'nl') =>
  variant(withGroups, language).tools;
