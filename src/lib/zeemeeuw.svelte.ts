import { vibrate } from './feedback';
import { logEvent } from './log';

// Easter egg: een zeemeeuw bestaat niet (het is een zilvermeeuw, kokmeeuw,
// stormmeeuw, …). Wie er toch een inspreekt of typt, krijgt een scherm vol
// boze meeuwen. De uitspraak wordt daarna gewoon verwerkt; het model maakt
// er een twijfelgeval van.

export const zeemeeuw = $state({ visible: false });

/** "zeemeeuw", "zeemeeuwen", "zee-meeuw", "Zee meeuw" */
const ZEEMEEUW = /zee[\s-]*meeuw/i;

export function mentionsZeemeeuw(text: string): boolean {
  return ZEEMEEUW.test(text);
}

/** Toont de meeuwen als de tekst een zeemeeuw noemt en de app zichtbaar is. */
export function checkZeemeeuw(text: string): void {
  if (!mentionsZeemeeuw(text) || document.hidden) return;
  zeemeeuw.visible = true;
  vibrate('angry');
  logEvent('zeemeeuw');
}
