// Installaties die nooit iets deden, om op te ruimen op Developer. Los van
// testers.ts en zonder import uit api.ts, zodat de proxy dit kan gebruiken
// zonder de rest van de app.

/** Het deel van `Tester` (api.ts) dat hier telt */
type Tester = {
  invitedAt?: number;
  usage?: unknown;
  lastUsed?: string;
  displayName?: string;
};

/**
 * Teken van leven na het aanmelden: een uitspraak in een sessie (ook zonder
 * delen, uit het verbruik), iets gedeeld, of een eigen naam opgegeven.
 */
export function hasActivity(tester: Tester): boolean {
  return tester.usage !== undefined || tester.lastUsed !== undefined || !!tester.displayName;
}

/**
 * Op te ruimen: aangemeld vóór vandaag (een dag de tijd) en daarna niets.
 * Meestal installaties van de eigenaar zelf (proberen, opnieuw installeren).
 * Of iemand de app wel opende zonder iets in te spreken, weet de proxy niet;
 * daarom blijft een opgeruimde installatie werken en komt hij terug in de
 * lijst zodra hij iets doet (worker/index.ts, `testers`).
 */
export function isUnused(tester: Tester, now = Date.now()): boolean {
  return (
    !hasActivity(tester) &&
    tester.invitedAt !== undefined &&
    now - tester.invitedAt >= 24 * 60 * 60 * 1000
  );
}
