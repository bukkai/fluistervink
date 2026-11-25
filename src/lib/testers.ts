import { OWNER, type Tester } from './api';
import { dayOf } from './costs';
import { weekOf, type ActivityRow, type SummaryRow } from './stats';
import { usedSince } from './unusedInstalls';

// De lijst met installaties op Developer: wie de laatste tijd actief was
// bovenaan, de rest achter "Toon meer".

/** Zo lang na het laatste gebruik (of het aanmelden) telt een installatie als actief */
export const ACTIVE_DAYS = 30;

/** Laatst gezien: de laatste uitspraak (verbruik of gedeeld), anders het aanmelden. */
export function lastSeen(tester: Tester): number | undefined {
  const times = [
    tester.lastUsed ? Date.parse(`${tester.lastUsed}T12:00:00Z`) : undefined,
    tester.usage?.lastActivity,
    tester.invitedAt,
  ].filter((t): t is number => t !== undefined && !Number.isNaN(t));
  return times.length ? Math.max(...times) : undefined;
}

/**
 * Actieve installaties (niet afgesloten, iets gedeeld, en gezien in de laatste
 * `ACTIVE_DAYS` dagen), en de rest; allebei met de laatst geziene bovenaan.
 * Wie nog niets deelde staat ook bij de rest: daar valt voor de eigenaar
 * (nog) niets aan te zien. Zijn eigen installaties ook, en die uit de testfase
 * die sinds de productierelease niets meer deden; wie doorgaat, is gewoon actief.
 */
export function splitActive(testers: Tester[], now = Date.now(), launchDay = LAUNCH_DAY) {
  const since = now - ACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const sorted = [...testers].sort((a, b) => (lastSeen(b) ?? 0) - (lastSeen(a) ?? 0));
  const isActive = (t: Tester) =>
    !t.blocked &&
    !t.owner &&
    !(inTestPhase(t, launchDay) && !usedSince(t, launchDay!)) &&
    t.usage !== undefined &&
    (lastSeen(t) ?? 0) >= since;
  return { active: sorted.filter(isActive), inactive: sorted.filter((t) => !isActive(t)) };
}

/** Namen van de installaties van de eigenaar zelf (aangemeld vóór de code) */
export function ownInstalls(testers: Tester[]): Set<string> {
  return new Set(testers.filter((t) => t.owner).map((t) => t.name));
}

/**
 * Verbruik of activiteit van een installatie van de eigenaar op naam van de
 * eigenaar, zodat Statistieken en de kosten hem net zo weglaten.
 */
export function asOwner<T extends { tester: string }>(rows: T[], own: Set<string>): T[] {
  if (!own.size) return rows;
  return rows.map((row) => (own.has(row.tester) ? { ...row, tester: OWNER } : row));
}

// --- Schone lei bij de productierelease. De testers van de gesloten test
// gebruiken dezelfde stabiele app als productie en houden hun installatie;
// wissen zou ze als nieuwe gebruikers laten tellen. Daarom niets wissen, maar
// Statistieken laat ze standaard weg (docs/proxy.md, Statistieken).

/**
 * Dag van de productierelease in Google Play (`2026-12-03`). Wie zich daarvóór
 * aanmeldde, hoort bij de testfase. `undefined` zolang er geen productie is:
 * dan telt iedereen gewoon mee.
 */
export const LAUNCH_DAY: string | undefined = undefined;

/** Een installatie uit de testfase: aangemeld vóór de productierelease. */
export function inTestPhase(tester: Tester, launchDay = LAUNCH_DAY): boolean {
  if (!launchDay || tester.owner) return false;
  return tester.invitedAt === undefined || dayOf(new Date(tester.invitedAt)) < launchDay;
}

/**
 * Namen die bij de testfase horen: installaties die zich vóór de release
 * aanmeldden, en wie al vóór de release iets insprak (ook testers van vóór het
 * aanmelden zonder code, of als de lijst met installaties niet te laden was).
 * De eigenaar hoort er niet bij; die heeft een eigen vinkje.
 */
export function testPhaseNames(
  rows: ActivityRow[],
  installs: Tester[],
  launchDay = LAUNCH_DAY,
): Set<string> {
  const names = new Set<string>();
  if (!launchDay) return names;
  for (const install of installs) if (inTestPhase(install, launchDay)) names.add(install.name);
  for (const row of rows) if (row.day < launchDay && row.tester !== OWNER) names.add(row.tester);
  return names;
}

/**
 * Uit de testfase en sinds de release niets meer ingesproken: die laat
 * Statistieken standaard weg. Wie na de release doorgaat, telt gewoon mee als
 * gebruiker (vandaag, deze week, de grafiek), maar niet als nieuwe gebruiker:
 * de trechter en "Blijven ze?" gaan over wie na de release begon.
 */
export function leftoverNames(
  rows: ActivityRow[],
  testPhase: Set<string>,
  launchDay = LAUNCH_DAY,
): Set<string> {
  if (!launchDay) return new Set();
  const continued = new Set(rows.filter((r) => r.day >= launchDay).map((r) => r.tester));
  return new Set([...testPhase].filter((name) => !continued.has(name)));
}

/**
 * Anonieme cijfers per sessie zonder de testfase. Die hebben geen installatie,
 * alleen de week waarin de installatie begon: alles van vóór de week van de
 * release valt weg, en ook cijfers zonder die week. Een installatie uit de
 * week van de release zelf, maar van vóór de dag, telt dus wel mee. Testers
 * die doorgaan vallen hier ook weg: de cijfers zeggen niet van wie ze zijn.
 */
export function withoutTestPhase(rows: SummaryRow[], launchDay = LAUNCH_DAY): SummaryRow[] {
  if (!launchDay) return rows;
  const week = weekOf(launchDay);
  return rows.filter((row) => row.cohort && row.cohort >= week);
}
