import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { language } from './i18n';

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

export interface SessionServiceResult {
  ok: boolean;
  /** Waarom het niet lukte */
  reden?: string;
  /** Mag de app meldingen tonen (Android 13+)? Anders draait de service zonder zichtbare melding */
  meldingen?: boolean;
}

interface WandelingPlugin {
  start(): Promise<SessionServiceResult>;
  stop(): Promise<void>;
  status(): Promise<{ draait: boolean; fout?: string; meldingen: boolean }>;
}

// De plugin heet in Java nog Wandeling (zoals in eerdere app-versies)
const Wandeling = registerPlugin<WandelingPlugin>('Wandeling');

/**
 * Foreground service met de melding "Aan het vogelen" (WandelingService.java):
 * houdt de app in leven met het scherm uit, zodat de wachtrij doorloopt en de
 * tril na het verwerken toch komt. In de browser bestaat dit niet.
 */
export async function startSessionService(): Promise<SessionServiceResult> {
  if (!isNativeApp) return { ok: false, reden: 'web' };
  try {
    return await Wandeling.start();
  } catch (error) {
    return { ok: false, reden: String(error) };
  }
}

export async function stopSessionService(): Promise<void> {
  if (isNativeApp) await Wandeling.stop().catch(() => {});
}

export async function sessionServiceStatus(): Promise<{ draait: boolean; fout?: string }> {
  if (!isNativeApp) return { draait: false };
  return Wandeling.status().catch((error) => ({ draait: false, fout: String(error) }));
}

interface BestandPlugin {
  opslaan(options: {
    naam: string;
    type: string;
    data: string;
  }): Promise<{ opgeslagen: boolean; map?: string }>;
}

const Bestand = registerPlugin<BestandPlugin>('Bestand');

/** Uitkomst van opslaan: false als de gebruiker annuleerde, anders waar het staat */
export type SaveResult = false | { folder?: string };

/**
 * Een bestand opslaan in Downloads (BestandPlugin.java; op Android 9 en ouder
 * via het "Opslaan als"-venster): de WebView van de app doet niets met een
 * gewone download. Gooit bij een fout.
 */
export async function saveFileNative(blob: Blob, filename: string): Promise<SaveResult> {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    // "data:<type>;base64,<data>": alleen het deel na de komma
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // Zonder "; charset=…": het venster kiest de extensie op het kale type
  const type = blob.type.split(';')[0] || 'application/octet-stream';
  const { opgeslagen, map } = await Bestand.opslaan({ naam: filename, type, data });
  return opgeslagen && { folder: map };
}

interface VersiePlugin {
  info(): Promise<{ versie: string; build: number }>;
}

const Versie = registerPlugin<VersiePlugin>('Versie');

/**
 * Versie van de geïnstalleerde Android-app (VersiePlugin.java), los van de
 * webcode die live van de site komt. Undefined in de browser; "ouder dan
 * 0.311" bij een app van vóór het versienummer.
 */
export async function nativeAppVersion(): Promise<string | undefined> {
  if (!isNativeApp) return undefined;
  try {
    const { versie } = await Versie.info();
    return versie;
  } catch {
    return 'ouder dan 0.311';
  }
}

interface IntegriteitPlugin {
  verklaring(options: { nonce: string; project?: string }): Promise<{ token: string }>;
}

const Integriteit = registerPlugin<IntegriteitPlugin>('Integriteit');

/**
 * Verklaring van Google Play dat dit de echte app is (IntegriteitPlugin.java),
 * om zonder toegangscode een token van de proxy te krijgen (install.ts).
 * Undefined in de browser, in een app van vóór de plugin, of als Google
 * weigert; de app probeert het dan met Turnstile.
 */
export async function playIntegrityToken(
  nonce: string,
  project?: string,
): Promise<string | undefined> {
  if (!isNativeApp) return undefined;
  try {
    return (await Integriteit.verklaring({ nonce, project })).token;
  } catch {
    return undefined;
  }
}

interface KnopPlugin {
  aan(): Promise<void>;
  uit(): Promise<void>;
  addListener(
    event: 'druk',
    listener: (data: { toets: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const Knop = registerPlugin<KnopPlugin>('Knop');

/** Kan deze app de volumeknop opvangen? Niet in de browser en niet in een app van vóór KnopPlugin.java */
export const volumeKeySupported = isNativeApp && Capacitor.isPluginAvailable('Knop');

/**
 * De volumeknoppen als inspreekknop (KnopPlugin.java): zolang dit loopt,
 * verandert de volumeknop het volume niet maar roept hij `onPress` aan.
 * Geeft een functie terug die het weer uitzet.
 */
export function listenVolumeKey(onPress: (key: string) => void): () => void {
  if (!volumeKeySupported) return () => {};
  let handle: PluginListenerHandle | undefined;
  let stopped = false;
  Knop.addListener('druk', ({ toets }) => onPress(toets)).then((h) => {
    if (stopped) h.remove();
    else handle = h;
  });
  Knop.aan().catch(() => {});
  return () => {
    stopped = true;
    handle?.remove();
    Knop.uit().catch(() => {});
  };
}

interface SnelkoppelingPlugin {
  zetten(options: { aan: boolean }): Promise<void>;
  wachtend(): Promise<{ actie?: string }>;
  addListener(
    event: 'actie',
    listener: (data: { actie: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const Snelkoppeling = registerPlugin<SnelkoppelingPlugin>('Snelkoppeling');

/** Kan deze app een snelkoppeling op het pictogram zetten (SnelkoppelingPlugin.java)? */
const shortcutSupported = isNativeApp && Capacitor.isPluginAvailable('Snelkoppeling');

/** Snelkoppeling "Begin met vogelen" op het app-pictogram aan of uit */
export async function setShortcut(on: boolean): Promise<void> {
  if (shortcutSupported) await Snelkoppeling.zetten({ aan: on }).catch(() => {});
}

/**
 * Roept `onAction` aan als de app via een snelkoppeling geopend is: eerst
 * voor de opening waarmee hij startte, daarna bij elke volgende.
 */
export function listenShortcut(onAction: (action: string) => void): void {
  if (!shortcutSupported) return;
  Snelkoppeling.addListener('actie', ({ actie }) => onAction(actie));
  Snelkoppeling.wachtend()
    .then(({ actie }) => actie && onAction(actie))
    .catch(() => {});
}

interface SprekenPlugin {
  /**
   * `taal`: de taal van de tekst. SprekenPlugin.java kiest nu nog altijd een
   * Nederlandse stem (nl-NL) en negeert dit veld; een volgende app-versie kan
   * het gebruiken voor een Engelse stem (ontwikkeloptie "English").
   */
  zeg(options: { tekst: string; taal: string }): Promise<{ gesproken: boolean; reden?: string }>;
}

const Spreken = registerPlugin<SprekenPlugin>('Spreken');

/** Kan deze app hardop praten in de oortjes (SprekenPlugin.java)? */
export const speechSupported = isNativeApp && Capacitor.isPluginAvailable('Spreken');

/**
 * Zegt de tekst in de oortjes, met de spraak van Android. Zonder oortjes
 * zegt hij niets (nooit via de luidspreker): `gesproken` is dan false.
 */
export async function speakNative(text: string): Promise<{ gesproken: boolean; reden?: string }> {
  if (!speechSupported) return { gesproken: false, reden: 'web' };
  try {
    return await Spreken.zeg({ tekst: text, taal: language });
  } catch (error) {
    return { gesproken: false, reden: String(error) };
  }
}

interface MicrofoonPlugin {
  status(): Promise<MicrophoneStatus>;
  vraagBluetooth(): Promise<MicrophoneStatus>;
}

/** `oortjes`: een headset met microfoon is verbonden. `bluetooth`: de WebView mag hem zien. */
export interface MicrophoneStatus {
  oortjes: boolean;
  bluetooth: boolean;
}

const Microfoon = registerPlugin<MicrofoonPlugin>('Microfoon');

const microphonePluginAvailable = isNativeApp && Capacitor.isPluginAvailable('Microfoon');

/**
 * Oortjes met microfoon verbonden (MicrofoonPlugin.java)? Undefined in de
 * browser of een oudere app-versie: dan weet alleen de lijst van de browser het.
 */
export async function nativeMicrophoneStatus(): Promise<MicrophoneStatus | undefined> {
  if (!microphonePluginAvailable) return undefined;
  try {
    return await Microfoon.status();
  } catch {
    return undefined;
  }
}

/** Vraagt "Apparaten in de buurt", zodat de WebView de microfoon van Bluetooth-oortjes ziet. */
export async function requestBluetoothMicrophone(): Promise<MicrophoneStatus | undefined> {
  if (!microphonePluginAvailable) return undefined;
  try {
    return await Microfoon.vraagBluetooth();
  } catch {
    return undefined;
  }
}

/** Een opname van de service, gemaakt met het scherm uit (SchermUitPlugin.java) */
export interface ScreenOffRecording {
  /** Bestandsnaam op de telefoon; met `doneScreenOffRecording` mag hij weg */
  id: string;
  sessieId: string;
  startedAt: number;
  durationMs: number;
  /** "audio/mp4" (AAC) */
  type: string;
  /** De opname in base64 */
  data: string;
  /** Tijdstippen in de service, om de overdracht te meten (ontbreken bij `wachtend`) */
  gestoptAt?: number;
  klaarAt?: number;
  verstuurdAt?: number;
  /** Hardste sample (0–32767): 0 = Android gaf alleen stilte */
  piek?: number;
  start?: string;
  stop?: string;
  /** Een stuk van een trektelling in de service (bestandsnaam eindigt op `_trektel`) */
  trektel?: boolean;
  /** Alleen bij een trektelstuk: spraak, niveaus en hoe lang het scherm uit was */
  spraakMs?: number;
  piekDb?: number;
  achtergrondDb?: number;
  schermUitMs?: number;
}

/** Knipregels voor de trektelling in de service (CHUNK_OPTIONS in trektel.ts) */
export interface NativeTrektelOptions {
  doelMs: number;
  pauzeMs: number;
  maxStukMs: number;
  minSpraakMs: number;
  margeDb: number;
  vloerDb: number;
  /** Hard maximum van de hele telling */
  maxMs: number;
}

/** Nieuws van de trektelling in de service (WandelingService.TrektelUitvoer) */
export type NativeTrektelEvent =
  | { soort: 'stuk_begint'; data: { startedAt: number } }
  | { soort: 'spreekt'; data: { ja: boolean } }
  | { soort: 'stuk'; data: { stukken: number; stil: number } }
  | { soort: 'gepauzeerd'; data: { waarom: string; schermUit: boolean } }
  | { soort: 'hervat'; data: { pausedMs: number; schermUit: boolean } }
  | { soort: 'gestopt'; data: NativeTrektelSummary };

/** Wat de telling deed, bij het stoppen */
export interface NativeTrektelSummary {
  reden?: string;
  durationMs?: number;
  stukken?: number;
  stil?: number;
  /** Accu in procent bij begin en eind */
  accuBegin?: number;
  accuEind?: number;
}

export interface ScreenOffOptions {
  sessieId: string;
  maxMs: number;
  minMs: number;
  trilStart: number[];
  trilStop: number[];
  /**
   * De WebView blijft zich in beeld melden (ZichtbareWebView.java, proef), zodat
   * Chromium de pagina met het scherm uit niet stilzet
   */
  zichtbaar?: boolean;
}

interface SchermUitPlugin {
  aan(options: ScreenOffOptions): Promise<{ ok: boolean; reden?: string }>;
  uit(): Promise<void>;
  stop(): Promise<void>;
  wachtend(): Promise<{ opnames: ScreenOffRecording[] }>;
  klaar(options: { id: string }): Promise<void>;
  webOpname(options: { bezig: boolean }): Promise<void>;
  trektelStart(options: NativeTrektelOptions): Promise<{ ok: boolean; reden?: string }>;
  trektelStop(): Promise<NativeTrektelSummary>;
  addListener(
    event: 'trektel',
    listener: (event: NativeTrektelEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'druk',
    listener: (data: { via: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'gestart',
    listener: (data: { startedAt: number; via: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'opname',
    listener: (data: ScreenOffRecording) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'log',
    listener: (data: { type: string; data: Record<string, unknown> }) => void,
  ): Promise<PluginListenerHandle>;
}

const SchermUit = registerPlugin<SchermUitPlugin>('SchermUit');

/** Kan deze app opnemen met het scherm uit (SchermUitPlugin.java, proef)? */
export const screenOffSupported = isNativeApp && Capacitor.isPluginAvailable('SchermUit');

export interface ScreenOffHandlers {
  /** De service begon een opname (volumeknop met het scherm uit) */
  onStart: (startedAt: number, via: string) => void;
  onRecording: (recording: ScreenOffRecording) => void;
  onLog: (type: string, data: Record<string, unknown>) => void;
  /** Volumeknop met het scherm uit terwijl de webcode zelf opneemt (zie `setWebRecording`) */
  onPress: (via: string) => void;
}

/**
 * Opnemen met het scherm uit (proef, docs/roadmap-android.md stap 3): zolang
 * dit loopt, start en stopt de volumeknop met het scherm uit een opname in de
 * service. Geeft een functie terug die het weer uitzet. In de browser niets.
 */
export function listenScreenOff(
  options: ScreenOffOptions,
  handlers: ScreenOffHandlers,
): { done: Promise<{ ok: boolean; reden?: string }>; stop: () => Promise<void> } {
  if (!screenOffSupported) {
    return { done: Promise.resolve({ ok: false, reden: 'web' }), stop: async () => {} };
  }
  const handles: Promise<PluginListenerHandle>[] = [
    SchermUit.addListener('gestart', ({ startedAt, via }) => handlers.onStart(startedAt, via)),
    SchermUit.addListener('opname', (recording) => handlers.onRecording(recording)),
    SchermUit.addListener('log', ({ type, data }) => handlers.onLog(type, data)),
    SchermUit.addListener('druk', ({ via }) => handlers.onPress(via)),
  ];
  const done = SchermUit.aan(options).catch((error) => ({ ok: false, reden: String(error) }));
  return {
    done,
    // Eerst uitzetten (de service maakt een lopende opname of het laatste
    // trektelstuk af), dan pas niet meer luisteren
    stop: async () => {
      await SchermUit.uit().catch(() => {});
      handles.forEach((handle) => handle.then((h) => h.remove()));
    },
  };
}

/**
 * Trektelling in de service (proef scherm uit): de service neemt op en knipt
 * zelf, ook met het scherm uit. De stukken komen als gewone opname
 * (`listenScreenOff`, met `trektel: true`); de stand via `listener`.
 * Geeft een functie terug die niet meer luistert.
 */
export function listenNativeTrektel(listener: (event: NativeTrektelEvent) => void): () => void {
  if (!screenOffSupported) return () => {};
  const handle = SchermUit.addListener('trektel', listener);
  return () => void handle.then((h) => h.remove());
}

export async function startNativeTrektel(
  options: NativeTrektelOptions,
): Promise<{ ok: boolean; reden?: string }> {
  if (!screenOffSupported) return { ok: false, reden: 'web' };
  return SchermUit.trektelStart(options).catch((error) => ({ ok: false, reden: String(error) }));
}

export async function stopNativeTrektel(): Promise<NativeTrektelSummary> {
  if (!screenOffSupported) return {};
  return SchermUit.trektelStop().catch(() => ({}));
}

/** Een lopende opname van de service stoppen (de knop in de app) */
export async function stopScreenOffRecording(): Promise<void> {
  if (screenOffSupported) await SchermUit.stop().catch(() => {});
}

/** Opnames die de service maakte terwijl de webcode ze niet aannam (app gesloten) */
export async function pendingScreenOffRecordings(): Promise<ScreenOffRecording[]> {
  if (!screenOffSupported) return [];
  return (await SchermUit.wachtend().catch(() => ({ opnames: [] }))).opnames;
}

/** De opname is bewaard in IndexedDB: het bestand op de telefoon mag weg */
export async function doneScreenOffRecording(id: string): Promise<void> {
  if (screenOffSupported) await SchermUit.klaar({ id }).catch(() => {});
}

/**
 * De webcode neemt zelf op (knop in de app): zolang dat zo is, start de
 * volumeknop met het scherm uit geen opname in de service maar komt hij als
 * `onPress` hier, om die opname te stoppen.
 */
export async function setWebRecording(busy: boolean): Promise<void> {
  if (screenOffSupported) await SchermUit.webOpname({ bezig: busy }).catch(() => {});
}
