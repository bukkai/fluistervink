import { transcribe as transcribeAudio, type Timing } from './api';
import { aliases, species } from './vocab';

// Spraak naar tekst via de proxy (OpenAI). De prompt stuurt de herkenning:
// een paar voorbeeldzinnen voor de stijl, en de soortnamen en bijnamen, zodat
// "tjiftjaf" of "tova" niet als iets anders verstaan worden.

export const TRANSCRIBE_MODEL = 'gpt-4o-transcribe';

/**
 * Alleen gewone en vrij gewone soorten (zeldzaamheid 1–2) en geen
 * verzamelsoorten: een kortere lijst stuurt gerichter, en zeldzame soorten
 * worden zelden ingesproken.
 */
const speciesNames = species.filter((s) => s.type === 'S' && s.rarity <= 2).map((s) => s.name);
const aliasNames = aliases.flatMap((a) => a.bijnamen);

const PROMPT = `Vogelwaarnemingen, ingesproken tijdens een wandeling. Bijvoorbeeld: "Fluistervink, zes overvliegende houtduiven." "Roepje vink." "Twee zingende tjiftjaffen." "Nee, keep in plaats van vink." "Nog drie erbij." "Die laatste weg." "Feedback: de knop reageert traag."

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
 * voor het verbruik per wandeling.
 */
export async function transcribe(
  audio: Blob,
  { model = TRANSCRIBE_MODEL, sessionId }: { model?: string; sessionId?: string } = {},
): Promise<{ text: string; confidence?: number; timing: Timing }> {
  const { data, timing } = await transcribeAudio(audio, { model, prompt: PROMPT, sessionId });
  return { text: data.text.trim(), confidence: data.confidence, timing };
}
