// Gewone keuzes bij Instellingen die standaard aan staan (eerst ontwikkelopties,
// voor iedereen sinds 11 nov). Per telefoon in localStorage; alleen "uit" wordt
// bewaard, zodat een nieuwe installatie ze meteen heeft.

export type Preference = 'zeldzaamOnzeker' | 'exportHerinnering' | 'samenvatting';

const PREFIX = 'fluistervink.pref.';

export function preferenceOn(preference: Preference): boolean {
  try {
    return localStorage.getItem(PREFIX + preference) !== '0';
  } catch {
    return true;
  }
}

export function setPreference(preference: Preference, on: boolean): void {
  try {
    if (on) localStorage.removeItem(PREFIX + preference);
    else localStorage.setItem(PREFIX + preference, '0');
  } catch {
    // Geen opslag: dan blijft hij aan
  }
}
