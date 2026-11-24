// Ontwikkelopties: nieuwe functies die eerst alleen de eigenaar ziet, tot ze
// bevallen (docs/roadmap-android.md, besloten 11 nov). Per telefoon in
// localStorage; bij Instellingen alleen bij de eigenaar, in de groep waar ze
// later als gewone keuze komen (DevOptions.svelte).

/**
 * - `oortjesMicrofoon`: de microfoon van Bluetooth-oortjes (microphone.ts)
 * - `schermUit`: opnemen met het scherm uit, met de volumeknop (proef,
 *   docs/roadmap-android.md stap 3)
 * - `oortjesKnop`: met `schermUit` ook de knop op de oortjes (claimt de
 *   mediaknop met een kort stil geluid; los sinds 24 nov, omdat dat bij een
 *   koptelefoon met twee apparaten muziek en de gesproken bevestiging leek
 *   weg te nemen)
 * - `english`: de app in het Engels, scherm én inspreken (docs/plan-engels.md,
 *   stap 3); aan- of uitzetten laadt de app opnieuw (i18n/index.ts)
 * - `spanje`: de soortenlijst van Spanje in plaats van die van Nederland
 *   (docs/plan-andere-landen.md, proef van 19 nov); laadt de app opnieuw
 *   (region.ts). Het vinkje staat er alleen nog als hij aan staat; de
 *   testset gebruikt hem met `--land es`
 * - `tuintelling`: een knop "Tuintelling" op het startscherm: een half uur
 *   tellen, daarna per soort het hoogste aantal (tuintelling.ts,
 *   docs/plan-tuintelling.md)
 * - `insecten`: met "Ook andere dieren inspreken" ook insecten (kevers,
 *   wantsen, hommels, bijen, wespen, nachtvlinders, sprinkhanen, zweefvliegen;
 *   insects.ts, docs/plan-insecten.md, laag 1)
 */
export type DevOption =
  | 'oortjesMicrofoon'
  | 'schermUit'
  | 'oortjesKnop'
  | 'english'
  | 'spanje'
  | 'tuintelling'
  | 'insecten';

const PREFIX = 'fluistervink.dev.';

export function devOptionOn(option: DevOption): boolean {
  try {
    return localStorage.getItem(PREFIX + option) === '1';
  } catch {
    return false;
  }
}

/** Gebeurtenis op `window` na het omzetten van een ontwikkeloptie */
export const DEV_OPTION_EVENT = 'fluistervink-dev-option';

export function setDevOption(option: DevOption, on: boolean): void {
  try {
    if (on) localStorage.setItem(PREFIX + option, '1');
    else localStorage.removeItem(PREFIX + option);
  } catch {
    // Geen opslag: dan blijft hij uit
  }
  // Zodat een scherm dat de optie al gelezen had, hem meteen toont of verbergt
  // (de knop Tuintelling verscheen pas na een herstart, 22 nov)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEV_OPTION_EVENT));
}
