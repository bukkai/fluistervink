// Gewone keuzes bij Instellingen (eerst ontwikkelopties, voor iedereen sinds
// 11 nov). De meeste staan standaard aan; `OFF_BY_DEFAULT` niet, want wie geen
// eBird gebruikt, mag er niets van merken (docs/plan-ebird.md, punt 8). Per
// telefoon in localStorage; alleen wat afwijkt van de standaard wordt bewaard,
// zodat een nieuwe installatie de standaard meteen heeft.

export type Preference = 'zeldzaamOnzeker' | 'exportHerinnering' | 'samenvatting' | 'ebird';

const OFF_BY_DEFAULT: readonly Preference[] = ['ebird'];

const PREFIX = 'fluistervink.pref.';
const SINCE = '.sinds';

export function preferenceOn(preference: Preference): boolean {
  const byDefault = !OFF_BY_DEFAULT.includes(preference);
  try {
    const stored = localStorage.getItem(PREFIX + preference);
    return stored === null ? byDefault : stored === '1';
  } catch {
    return byDefault;
  }
}

/**
 * Sinds wanneer een keuze aan staat die standaard uit is: wat eraan
 * voorafging, hoeft er niet alsnog aan mee te doen (oude sessies en eBird).
 * Stond hij al aan voordat dit werd bijgehouden, dan vanaf nu.
 */
export function preferenceSince(preference: Preference): number | undefined {
  if (!preferenceOn(preference)) return undefined;
  try {
    const stored = Number(localStorage.getItem(PREFIX + preference + SINCE));
    if (stored > 0) return stored;
    const now = Date.now();
    localStorage.setItem(PREFIX + preference + SINCE, String(now));
    return now;
  } catch {
    return undefined;
  }
}

export function setPreference(preference: Preference, on: boolean): void {
  try {
    // Sinds wanneer een keuze aan staat die standaard uit is (`preferenceSince`)
    if (OFF_BY_DEFAULT.includes(preference)) {
      if (on) localStorage.setItem(PREFIX + preference + SINCE, String(Date.now()));
      else localStorage.removeItem(PREFIX + preference + SINCE);
    }
    if (on === !OFF_BY_DEFAULT.includes(preference)) localStorage.removeItem(PREFIX + preference);
    else localStorage.setItem(PREFIX + preference, on ? '1' : '0');
  } catch {
    // Geen opslag: dan blijft het de standaard
  }
}
