import { transcribe as transcribeAudio, type Timing } from './api';
import { aliases, species } from './vocab';

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
export const PROMPT_EXAMPLES = [
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

/** Korte hash van model en prompt, zoals bij de interpretatie. */
export const transcribePromptVersion: Promise<string> = crypto.subtle
  .digest('SHA-256', new TextEncoder().encode(TRANSCRIBE_MODEL + PROMPT))
  .then((hash) =>
    [...new Uint8Array(hash).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  );

/**
 * `model`: alleen anders voor de testset (scripts/testset.mjs). `sessionId`:
 * voor het verbruik per sessie.
 */
export async function transcribe(
  audio: Blob,
  { model = TRANSCRIBE_MODEL, sessionId }: { model?: string; sessionId?: string } = {},
): Promise<{ text: string; confidence?: number; timing: Timing }> {
  const { data, timing } = await transcribeAudio(audio, { model, prompt: PROMPT, sessionId });
  return { text: data.text.trim(), confidence: data.confidence, timing };
}

function words(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

const EXAMPLE_WORDS = new Set(PROMPT_EXAMPLES.map(words));

/**
 * Het transcript is letterlijk een voorbeeldzin uit de prompt. Bij een
 * onverstaanbare opname zet de spraakherkenning soms een voorbeeld neer
 * ("Roepje vink." bij Jurians koperwiek, 6 nov): geloofwaardig en verzonnen.
 */
export function isPromptExample(transcript: string | undefined): boolean {
  return !!transcript && EXAMPLE_WORDS.has(words(transcript));
}
