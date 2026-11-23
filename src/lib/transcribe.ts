import { transcribe as transcribeAudio, type Timing, type UsageKind } from './api';
import { translate, type Language } from './i18n';
import {
  aliases,
  aliasesOf,
  BIRDS,
  groups,
  promptSpeciesOf,
  species,
  speciesNameIn,
  type Species,
} from './vocab';

// Spraak naar tekst via de proxy (OpenAI). De prompt stuurt de herkenning:
// een paar voorbeeldzinnen voor de stijl, en de soortnamen en bijnamen, zodat
// "tjiftjaf" of "tova" niet als iets anders verstaan worden.

/**
 * Gekozen op 6 nov met de testset (401 opnames van vier sprekers): 85% goed
 * tegen 82% voor gpt-4o-transcribe, dat op 26 feb 2027 verdwijnt. Sneller,
 * goedkoper en verzint minder vaak een vogel bij geritsel. Soortnamen als
 * `keywords` (nieuw bij dit model) maakten geen verschil.
 */
export const TRANSCRIBE_MODEL = 'gpt-transcribe';

/**
 * Alleen gewone en vrij gewone soorten (zeldzaamheid 1–2) en geen
 * verzamelsoorten: een kortere lijst stuurt gerichter, en zeldzame soorten
 * worden zelden ingesproken.
 */
const speciesNames = species.filter((s) => s.type === 'S' && s.rarity <= 2).map((s) => s.name);
const aliasNames = aliases.flatMap((a) => a.bijnamen);

/** Voorbeeldzinnen in de prompt, voor de stijl */
const PROMPT_EXAMPLES = [
  'Fluistervink, zes overvliegende houtduiven.',
  'Roepje vink.',
  'Twee zingende tjiftjaffen.',
  'Nee, keep in plaats van vink.',
  'Nog drie erbij.',
  'Die laatste weg.',
  'Feedback: de knop reageert traag.',
];

const PROMPT = `Vogelwaarnemingen, ingesproken tijdens het vogelen. Bijvoorbeeld: ${PROMPT_EXAMPLES.map((e) => `"${e}"`).join(' ')}

Vogelnamen: ${speciesNames.join(', ')}.

Bijnamen: ${aliasNames.join(', ')}.

Leeftijd en kleed: 1kj, 2kj, 3kj, 1w, 2w, 1z, juv, ad, subad, imm, pullus, eclips, zomerkleed, winterkleed. Nocmig.`;

/**
 * Met de andere soortgroepen (keuze 'soortgroepen' bij Instellingen): ook hun namen,
 * met dezelfde keuze (gewoon en vrij gewoon, geen verzamelsoorten). Of dat de
 * vogelnamen slechter maakt, meet de testset (`--soortgroepen`).
 */
const otherGroups = groups.filter((g) => g.id !== BIRDS);
const PROMPT_WITH_GROUPS = `${PROMPT}

${otherGroups
  .map((g) => {
    const names = promptSpeciesOf(g.id)
      .filter((s) => s.type === 'S' && s.rarity <= 2)
      .map((s) => s.name);
    const nicknames = aliasesOf(g.id).flatMap((a) => a.bijnamen);
    return `${g.name}: ${[...names, ...nicknames].join(', ')}.`;
  })
  .join('\n')}`;

// ---------------------------------------------------------------------------
// Engels (ontwikkeloptie "English", docs/plan-engels.md, stap 3): dezelfde
// opzet, met Engelse voorbeeldzinnen, de Engelse namen van dezelfde selectie
// soorten en de Engelse leeftijdscodes. Nog geen Engelse bijnamen: die komen
// pas als de Engelse testset ze laat zien (data/bijnamen-en.json, stap 4).

/** Gewone soorten zonder verzamelsoorten, zoals hierboven */
const commonSpecies = (list: Species[]) => list.filter((s) => s.type === 'S' && s.rarity <= 2);
const englishNames = (list: Species[]) => commonSpecies(list).map((s) => speciesNameIn('en', s.id));

const PROMPT_EXAMPLES_EN = [
  'Fluistervink, six Woodpigeons flying over.',
  'Chaffinch calling.',
  'Two Chiffchaffs singing.',
  'No, Brambling instead of Chaffinch.',
  'Three more.',
  'Scratch that last one.',
  'Feedback: the button is slow to respond.',
];

const PROMPT_EN = `Bird observations, spoken while birding. For example: ${PROMPT_EXAMPLES_EN.map((e) => `"${e}"`).join(' ')}

Bird names: ${englishNames(species).join(', ')}.

Age and plumage: 1cy, 2cy, 3cy, 1w, 2w, 1s, juv, ad, subad, imm, pullus, eclipse, summer plumage, winter plumage. Nocmig.`;

const PROMPT_EN_WITH_GROUPS = `${PROMPT_EN}

${otherGroups
  .map(
    (g) =>
      `${translate('en', `group.${g.id}`)}: ${englishNames(promptSpeciesOf(g.id)).join(', ')}.`,
  )
  .join('\n')}`;

const promptFor = (withGroups: boolean, language: Language = 'nl') =>
  language === 'en'
    ? withGroups
      ? PROMPT_EN_WITH_GROUPS
      : PROMPT_EN
    : withGroups
      ? PROMPT_WITH_GROUPS
      : PROMPT;

/** Korte hash van model en prompt, zoals bij de interpretatie. */
export function transcribePromptVersionFor(
  withGroups = false,
  language: Language = 'nl',
): Promise<string> {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(TRANSCRIBE_MODEL + promptFor(withGroups, language)))
    .then((hash) =>
      [...new Uint8Array(hash).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(''),
    );
}

/**
 * `model`: alleen anders voor de testset (scripts/testset.mjs). `sessionId`:
 * voor het verbruik per sessie. `groups`: ook namen van andere dieren.
 * `language`: de taal waarin is ingesproken (prompt en spraakherkenning).
 */
export async function transcribe(
  audio: Blob,
  {
    model = TRANSCRIBE_MODEL,
    sessionId,
    groups = false,
    language = 'nl',
    kind,
  }: {
    model?: string;
    sessionId?: string;
    groups?: boolean;
    language?: Language;
    kind?: UsageKind;
  } = {},
): Promise<{ text: string; confidence?: number; timing: Timing }> {
  const { data, timing } = await transcribeAudio(audio, {
    model,
    prompt: promptFor(groups, language),
    sessionId,
    language,
    kind,
  });
  return { text: data.text.trim(), confidence: data.confidence, timing };
}
