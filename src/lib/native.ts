import { Capacitor, registerPlugin } from '@capacitor/core';

// Het enige bestand dat weet of de app in de Android-app draait (Capacitor) of
// in de browser. Elke native functie heeft een terugval op de web-API, zodat
// de PWA (ook op een iPhone) gewoon blijft werken. Zie docs/plan-capacitor.md.

/** In de Android-app, niet in de browser */
export const isNativeApp = Capacitor.isNativePlatform();

/** Waar de app draait, voor het log en de export */
export const PLATFORM = isNativeApp ? `${Capacitor.getPlatform()}-app` : 'web';

interface TrillenPlugin {
  patroon(options: { patroon: number[] }): Promise<{ ok: boolean }>;
}

const Trillen = registerPlugin<TrillenPlugin>('Trillen');

/**
 * Trilt via Android zelf, los van "Touch feedback" (zie TrillenPlugin.java).
 * Geeft false als het niet lukte, zodat de webcode het kan loggen.
 */
export async function vibrateNative(pattern: number[]): Promise<boolean> {
  try {
    return (await Trillen.patroon({ patroon: pattern })).ok;
  } catch {
    return false;
  }
}
