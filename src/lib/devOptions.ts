// Ontwikkelopties: nieuwe functies die eerst alleen de eigenaar ziet, tot ze
// bevallen (docs/roadmap-android.md, besloten 11 nov). Per telefoon in
// localStorage; bij Instellingen alleen bij de eigenaar, in de groep waar ze
// later als gewone keuze komen (DevOptions.svelte).

/**
 * - `oortjesMicrofoon`: de microfoon van Bluetooth-oortjes (microphone.ts)
 * - `schermUit`: opnemen met het scherm uit, met de volumeknop of de knop op
 *   de oortjes (proef, docs/roadmap-android.md stap 3)
 * - `english`: de app in het Engels, scherm én inspreken (docs/plan-engels.md,
 *   stap 3); aan- of uitzetten laadt de app opnieuw (i18n/index.ts)
 */
export type DevOption = 'oortjesMicrofoon' | 'schermUit' | 'english';

const PREFIX = 'fluistervink.dev.';

export function devOptionOn(option: DevOption): boolean {
  try {
    return localStorage.getItem(PREFIX + option) === '1';
  } catch {
    return false;
  }
}

export function setDevOption(option: DevOption, on: boolean): void {
  try {
    if (on) localStorage.setItem(PREFIX + option, '1');
    else localStorage.removeItem(PREFIX + option);
  } catch {
    // Geen opslag: dan blijft hij uit
  }
}
