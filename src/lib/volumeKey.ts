// Instelling: de volumeknop als inspreekknop, alleen in de Android-app
// (KnopPlugin.java, docs/roadmap-android.md stap 1). Standaard uit: wie het
// niet weet, wil met de volumeknop gewoon het volume regelen.

const SETTING_KEY = 'fluistervink.volumeknop';

export function volumeKeyEnabled(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setVolumeKeyEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(SETTING_KEY, '1');
    else localStorage.removeItem(SETTING_KEY);
  } catch {
    // Geen opslag: dan blijft hij uit
  }
}
