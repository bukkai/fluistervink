// Wat de gebruiker van een update ziet: onderin een smal balkje terwijl de
// nieuwe versie binnenkomt, en na het herladen even "Bijgewerkt naar versie
// …" (src/lib/UpdateStatus.svelte). De update zelf staat in update.ts.

import { APP_VERSION } from './log';

const LAST_VERSION_KEY = 'fluistervink.lastVersion';

export const updateStatus = $state({
  /** Er komt een nieuwe versie binnen (service worker installeert) */
  loading: false,
  /** Net bijgewerkt naar deze versie (leeg = niet) */
  updatedTo: '',
});

/**
 * Of deze versie anders is dan de vorige keer dat de app openging, en dan
 * welke. Bij de allereerste keer niets: dat is een installatie, geen update.
 * Bewaart meteen de huidige versie.
 */
export function versionChange(storage: Storage, version: string): string {
  try {
    const last = storage.getItem(LAST_VERSION_KEY);
    if (last !== version) storage.setItem(LAST_VERSION_KEY, version);
    return last && last !== version ? version : '';
  } catch {
    // Geblokkeerde opslag: dan geen melding
    return '';
  }
}

updateStatus.updatedTo = versionChange(localStorage, APP_VERSION);
