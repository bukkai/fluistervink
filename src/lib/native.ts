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

export interface WalkServiceResult {
  ok: boolean;
  /** Waarom het niet lukte */
  reden?: string;
  /** Mag de app meldingen tonen (Android 13+)? Anders draait de service zonder zichtbare melding */
  meldingen?: boolean;
}

interface WandelingPlugin {
  start(): Promise<WalkServiceResult>;
  stop(): Promise<void>;
  status(): Promise<{ draait: boolean; fout?: string; meldingen: boolean }>;
}

const Wandeling = registerPlugin<WandelingPlugin>('Wandeling');

/**
 * Foreground service met de melding "Wandeling loopt" (WandelingService.java):
 * houdt de app in leven met het scherm uit, zodat de wachtrij doorloopt en de
 * tril na het verwerken toch komt. In de browser bestaat dit niet.
 */
export async function startWalkService(): Promise<WalkServiceResult> {
  if (!isNativeApp) return { ok: false, reden: 'web' };
  try {
    return await Wandeling.start();
  } catch (error) {
    return { ok: false, reden: String(error) };
  }
}

export async function stopWalkService(): Promise<void> {
  if (isNativeApp) await Wandeling.stop().catch(() => {});
}

export async function walkServiceStatus(): Promise<{ draait: boolean; fout?: string }> {
  if (!isNativeApp) return { draait: false };
  return Wandeling.status().catch((error) => ({ draait: false, fout: String(error) }));
}

interface BestandPlugin {
  opslaan(options: { naam: string; type: string; data: string }): Promise<{ opgeslagen: boolean }>;
}

const Bestand = registerPlugin<BestandPlugin>('Bestand');

/**
 * Een bestand opslaan via het "Opslaan als"-venster van Android
 * (BestandPlugin.java): de WebView van de app doet niets met een gewone
 * download. Geeft false als de gebruiker annuleert; gooit bij een fout.
 */
export async function saveFileNative(blob: Blob, filename: string): Promise<boolean> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    // "data:<type>;base64,<data>": alleen het deel na de komma
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // Zonder "; charset=…": het venster kiest de extensie op het kale type
  const type = blob.type.split(';')[0] || 'application/octet-stream';
  return (await Bestand.opslaan({ naam: filename, type, data })).opgeslagen;
}
