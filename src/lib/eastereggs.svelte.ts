import { vibrate } from './feedback';
import type { Action } from './interpret';
import { logEvent } from './log';

// Easter eggs na het verwerken van een uitspraak (de zeemeeuw staat apart in
// zeemeeuw.svelte.ts). Alleen als de app zichtbaar is; de waarneming zelf
// wordt gewoon opgeslagen.
//
// #tocheenbuizerd: een grap uit de Discord. Elke spannende roofvogel blijkt
// toch een buizerd te zijn, en dan komt er een krijsende buizerd. Hier: een
// waarneming wordt een buizerd met woorden als "toch een buizerd".
//
// Lifer: een soort die je voor het eerst ziet. De app houdt dat niet bij; de
// gebruiker zegt het zelf, en dan komen er slingers en confetti.

export const BUIZERD_ID = 82;

export const tochEenBuizerd = $state({ visible: false });
export const lifer = $state<{ visible: boolean; speciesId?: number }>({ visible: false });

/**
 * "toch een buizerd", "het is toch maar een buizerd", "gewoon een buizerd",
 * "buizerd toch"; in het Engels "just a buzzard", "a buzzard after all". Ook
 * "buizert", zoals de spraakherkenning het soms schrijft. "Weer een buizerd"
 * niet: dat is gewoon de volgende.
 */
const TOCH_EEN_BUIZERD = [
  /\b(toch|gewoon)\b[^.?!]{0,25}\bbuizer[dt]\b/i,
  /\bbuizer[dt]\b[\s,]*\btoch\b/i,
  /#?\s*toch\s*een\s*buizer[dt]/i,
  /\b(just|only)\b[^.?!]{0,15}\bbuzzard\b/i,
  /\bbuzzard\b[^.?!]{0,10}\bafter all\b/i,
];

export function saysTochEenBuizerd(text: string): boolean {
  return TOCH_EEN_BUIZERD.some((pattern) => pattern.test(text));
}

/** Maakt een van de acties een buizerd (een nieuwe of een aangepaste waarneming)? */
export function makesBuizerd(actions: Action[]): boolean {
  return actions.some(
    (a) => (a.type === 'add' || a.type === 'update') && a.fields.speciesId === BUIZERD_ID,
  );
}

/**
 * "lifer", "lifers", "een lifer!"; ook zoals de spraakherkenning het kan
 * schrijven ("laifer", "lijfer"). Niet midden in een ander woord.
 */
const LIFER = /(?<![\p{L}])(lifer|laifer|lijfer|lyfer)s?(?![\p{L}])/iu;

export function mentionsLifer(text: string): boolean {
  return LIFER.test(text);
}

/** De soort van de lifer: de eerste soort die deze uitspraak toevoegt of aanpast. */
export function liferSpecies(actions: Action[]): number | undefined {
  for (const a of actions) {
    if ((a.type === 'add' || a.type === 'update') && a.fields.speciesId !== undefined)
      return a.fields.speciesId;
  }
  return undefined;
}

/**
 * Het eigen trilpatroon pas na de gewone bevestiging (opgeslagen, onzeker),
 * die meteen na het opslaan komt: die zegt de vogelaar meer.
 */
const VIBRATE_AFTER_MS = 1000;

/** Na het opslaan van een uitspraak: de buizerd of de lifer, als het zo uitkomt. */
export function checkEasterEggs(transcript: string, actions: Action[]): void {
  if (document.hidden || !transcript) return;
  if (mentionsLifer(transcript)) {
    lifer.speciesId = liferSpecies(actions);
    lifer.visible = true;
    setTimeout(() => vibrate('party'), VIBRATE_AFTER_MS);
    logEvent('lifer');
  } else if (saysTochEenBuizerd(transcript) && makesBuizerd(actions)) {
    tochEenBuizerd.visible = true;
    setTimeout(() => vibrate('buizerd'), VIBRATE_AFTER_MS);
    logEvent('tocheenbuizerd');
  }
}
