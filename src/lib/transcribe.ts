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
  'Wielewaal, een lifer!',
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
  'Golden Oriole, a lifer!',
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

// ---------------------------------------------------------------------------
// Teruggegeven prompt. Bij een stuk met weinig of zachte spraak geeft de
// spraakherkenning soms een stuk van de prompt terug als tekst: de
// voorbeeldzinnen, of de hele soortenlijst (twee keer op 27 nov, in een
// trektelling). Het model maakte er de eerste keer waarnemingen van.

/** Zoveel delen van de prompt achter elkaar is geen spraak meer */
const MIN_ECHO_PARTS = 8;

const normalize = (part: string) =>
  part
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Delen van een tekst tussen komma's en leestekens, met hun plek in de tekst */
function partsOf(text: string): { part: string; start: number; end: number }[] {
  return [...text.matchAll(/[^,.!?:;"\n]+/g)]
    .map((m) => ({ part: normalize(m[0]), start: m.index, end: m.index + m[0].length }))
    .filter((p) => p.part);
}

/** Per deel van de prompt de plekken waar het staat */
function promptIndex(prompt: string): Map<string, number[]> {
  const index = new Map<string, number[]>();
  partsOf(prompt).forEach(({ part }, i) => index.set(part, [...(index.get(part) ?? []), i]));
  return index;
}

const promptIndexes = new Map<string, Map<string, number[]>>();

/**
 * Haalt teruggegeven stukken prompt uit een transcript: een reeks van minstens
 * `MIN_ECHO_PARTS` delen die in de prompt staan, in dezelfde volgorde. Zo'n
 * reeks spreekt niemand in (zeker niet zonder aantallen, op de volgorde van de
 * soortenlijst); wat ervoor of erna staat, blijft. `removed`: hoeveel delen
 * eruit gingen (0 = niets teruggegeven).
 */
export function stripPromptEcho(text: string, prompt: string): { text: string; removed: number } {
  let index = promptIndexes.get(prompt);
  if (!index) promptIndexes.set(prompt, (index = promptIndex(prompt)));
  const parts = partsOf(text);
  const runs: { from: number; to: number }[] = [];
  let run: { from: number; to: number; at: number } | undefined;
  parts.forEach(({ part }, i) => {
    const next = index.get(part)?.find((at) => run === undefined || at > run.at);
    if (run && next !== undefined) {
      run.to = i;
      run.at = next;
      return;
    }
    if (run && run.to - run.from + 1 >= MIN_ECHO_PARTS) runs.push(run);
    const first = index.get(part)?.[0];
    run = first === undefined ? undefined : { from: i, to: i, at: first };
  });
  if (run && run.to - run.from + 1 >= MIN_ECHO_PARTS) runs.push(run);
  if (!runs.length) return { text, removed: 0 };
  let rest = text;
  for (const { from, to } of [...runs].reverse()) {
    // Met de leestekens erachter, zodat er geen losse punt blijft staan
    const end = parts[to].end + /^[\s,.!?:;"]*/.exec(rest.slice(parts[to].end))![0].length;
    rest = rest.slice(0, parts[from].start) + rest.slice(end);
  }
  rest = rest.trim();
  return {
    text: /[\p{L}\p{N}]/u.test(rest) ? rest : '',
    removed: runs.reduce((n, { from, to }) => n + to - from + 1, 0),
  };
}

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
 * `promptEcho`: hoeveel delen van de prompt de spraakherkenning teruggaf en de
 * app eruit haalde (`stripPromptEcho`).
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
): Promise<{ text: string; confidence?: number; timing: Timing; promptEcho?: number }> {
  const prompt = promptFor(groups, language);
  const { data, timing } = await transcribeAudio(audio, {
    model,
    prompt,
    sessionId,
    language,
    kind,
  });
  const { text, removed } = stripPromptEcho(data.text.trim(), prompt);
  return {
    text,
    confidence: data.confidence,
    timing,
    ...(removed ? { promptEcho: removed } : {}),
  };
}
