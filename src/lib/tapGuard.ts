/**
 * Na Klopt of Weg verschijnt op dezelfde plek het volgende item (bij het
 * nalopen de volgende onzekere waarneming, in de lijst schuift de rij eronder
 * omhoog). Een dubbele tik, of een tweede tik met handschoenen, raakte dan dat
 * volgende item. Zo lang na een actie telt een tik niet.
 */
export const TAP_PAUSE_MS = 500;

/**
 * Geeft een functie die een klik-handler zo maakt dat hij binnen
 * `pauseMs` na de vorige (van dezelfde guard) niets doet.
 */
export function tapGuard(pauseMs = TAP_PAUSE_MS) {
  let last = -Infinity;
  return <A extends unknown[]>(handler: (...args: A) => unknown) =>
    (...args: A): void => {
      const now = Date.now();
      if (now - last < pauseMs) return;
      last = now;
      handler(...args);
    };
}
