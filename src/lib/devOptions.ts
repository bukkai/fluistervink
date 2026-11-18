// Ontwikkelopties: nieuwe functies die eerst alleen de eigenaar ziet, tot ze
// bevallen (docs/roadmap-android.md, besloten 11 nov). Per telefoon in
// localStorage; het kaartje bij Instellingen staat alleen bij de eigenaar.

/**
 * - `oortjesMicrofoon`: de microfoon van Bluetooth-oortjes (microphone.ts)
 * - `schermUit`: opnemen met het scherm uit, met de volumeknop (proef,
 *   docs/roadmap-android.md stap 3)
 */
export type DevOption = 'oortjesMicrofoon' | 'schermUit';

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
