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

const PROMPT = `Vogelwaarnemingen, ingesproken tijdens een wandeling. Bijvoorbeeld: "Thijsse, zes overvliegende houtduiven." "Roepje vink." "Twee zingende tjiftjaffen." "Nee, keep in plaats van vink." "Nog drie erbij." "Die laatste weg." "Dev note: de knop reageert traag."

Vogelnamen: ${speciesNames.join(', ')}.

Bijnamen: ${aliasNames.join(', ')}.`;

/** Korte hash van model en prompt, zoals bij de interpretatie. */
export const transcribePromptVersion: Promise<string> = crypto.subtle
  .digest('SHA-256', new TextEncoder().encode(TRANSCRIBE_MODEL + PROMPT))
  .then((hash) =>
    [...new Uint8Array(hash).slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  );

export async function transcribe(audio: Blob): Promise<{ text: string; timing: Timing }> {
  const { data, timing } = await transcribeAudio(audio, { model: TRANSCRIBE_MODEL, prompt: PROMPT });
  return { text: data.text.trim(), timing };
}
