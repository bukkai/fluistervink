// Installaties die nooit iets deden, om op te ruimen op Developer. Los van
// testers.ts en zonder import uit api.ts, zodat de proxy dit kan gebruiken
// zonder de rest van de app.

/** Het deel van `Tester` (api.ts) dat hier telt */
type Tester = {
  invitedAt?: number;
  usage?: { lastActivity?: number };
  lastUsed?: string;
  displayName?: string;
  owner?: boolean;
  blocked?: boolean;
};

const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' });
/** `2026-12-03` in Nederlandse tijd, zoals de proxy het verbruik telt */
const dayOf = (ms: number) => dayFormat.format(ms);

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

/**
 * Iets gedaan na `since` (milliseconden): een uitspraak op een latere dag, of
 * iets gedeeld. Een opgeruimde installatie uit de testfase komt hiermee terug
 * in de lijst; vóór het opruimen deed hij immers al wel iets.
 */
export function activeAfter(tester: Tester, since: number): boolean {
  return (
    (tester.usage?.lastActivity ?? 0) > since ||
    (tester.lastUsed !== undefined && tester.lastUsed > dayOf(since))
  );
}

/** Iets ingesproken of gedeeld op of na dag `day` (`2026-12-03`). */
export function usedSince(tester: Tester, day: string): boolean {
  const shared = tester.usage?.lastActivity;
  return (
    (tester.lastUsed !== undefined && tester.lastUsed >= day) ||
    (shared !== undefined && dayOf(shared) >= day)
  );
}

/**
 * Achtergebleven uit de testfase: aangemeld vóór de productierelease
 * (`launchDay`) en sindsdien niets meer gedaan. Op Developer na drie maanden
 * op te ruimen; net als bij `isUnused` blijft hij werken.
 */
export function isLeftover(tester: Tester, launchDay: string): boolean {
  return (
    !tester.owner &&
    !tester.blocked &&
    (tester.invitedAt === undefined || dayOf(tester.invitedAt) < launchDay) &&
    !usedSince(tester, launchDay)
  );
}

/** Zo lang na de productierelease kan de testfase worden opgeruimd */
export const LEFTOVER_DAYS = 90;
