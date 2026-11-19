// Opname in de trektelmodus (docs/plan-trektelmodus.md). De microfoon blijft
// aan; per stuk een nieuwe MediaRecorder op dezelfde stream, zodat elk stuk
// een los, afspeelbaar bestand is. Het nieuwe stuk start vóórdat het vorige
// stopt, zodat er tussen twee stukken niets wegvalt. Een AnalyserNode meet
// het geluidsniveau; de rekenregels voor het knippen staan in trektel.ts.
//
// Proef scherm uit (ontwikkeloptie `schermUit`, alleen de beta-build): heeft
// de service het type microfoon, dan neemt de service de hele telling op en
// knipt hij zelf (TrektelOpname.java, met dezelfde regels). De webcode houdt
// dan alleen de stand bij; de stukken komen binnen als opname met het scherm
// uit (screenOff.svelte.ts), met de positie die hier bij het begin van elk
// stuk is opgevraagd (`takeChunkLookup`). Het scherm mag dan uit, en een
// andere app die de microfoon wil, pauzeert de telling (Android geeft ons
// dan stilte).

import { t } from './i18n';
import type { PositionLookup } from './db';
import { logEvent } from './log';
import { openMicrophone } from './microphone';
import {
  listenNativeTrektel,
  startNativeTrektel,
  stopNativeTrektel,
  type NativeTrektelEvent,
  type NativeTrektelSummary,
} from './native';
import { noteMicrophone } from './microphoneStatus.svelte';
import { AUDIO_BITS_PER_SECOND, MIME_TYPES, type Recording } from './recorder.svelte';
import {
  CHUNK_OPTIONS,
  createChunker,
  FRAME_MS,
  levelDb,
  TREKTEL_MAX_MS,
  TREKTEL_PAUSE_MAX_MS,
  type Cut,
} from './trektel';

/** `limit`: de proxy verwerkt vandaag niets meer (plafond per dag) */
type StopReason = 'max' | 'hidden' | 'limit' | 'storage' | 'mic';

export interface TrektelHandlers {
  /** Bij het begin van elk stuk: de positie van dat moment opvragen. */
  onChunkStart: () => Promise<PositionLookup>;
  /** Een stuk met spraak; `startedAt` is het begin van dat stuk. */
  onChunk: (recording: Recording, lookup: Promise<PositionLookup>) => void;
  /** De trektelling stopte vanzelf (maximum, app naar de achtergrond, plafond per dag). */
  onStopped: (reason: StopReason) => void;
  /**
   * Naar een andere app (Merlin) of scherm op slot: de telling pauzeert. De
   * microfoon gaat dan uit, zodat de andere app hem kan gebruiken, en weer aan
   * als je terugkomt (binnen een kwartier, anders stopt hij alsnog).
   */
  onPaused?: () => void;
  onResumed?: () => void;
}

export const trektel = $state<{
  /** `paused`: microfoon uit omdat de app op de achtergrond staat */
  status: 'idle' | 'starting' | 'running' | 'paused';
  startedAt?: number;
  /** Hoort de app nu spraak (lampje op het scherm) */
  speaking: boolean;
  /** Starten lukte niet (geen toegang tot de microfoon) */
  error?: string;
  /** Aantal verstuurde en overgeslagen (stille) stukken */
  sent: number;
  skipped: number;
  /** De service neemt op (proef scherm uit): het scherm mag uit */
  native: boolean;
}>({ status: 'idle', speaking: false, sent: 0, skipped: 0, native: false });

interface Chunk {
  recorder: MediaRecorder;
  parts: Blob[];
  startedAt: number;
  lookup: Promise<PositionLookup>;
  /** Vast per stuk: het laatste stuk komt binnen als de trektelling al gestopt is */
  onChunk: TrektelHandlers['onChunk'];
}

let stream: MediaStream | undefined;
let audioContext: AudioContext | undefined;
let meter: ReturnType<typeof setInterval> | undefined;
let maxTimer: ReturnType<typeof setTimeout> | undefined;
let current: Chunk | undefined;
let wakeLock: WakeLockSentinel | undefined;
let handlers: TrektelHandlers | undefined;
/** Rondt het laatste stuk af bij het stoppen */
let stopChunker: (() => Cut) | undefined;
let pausedAt: number | undefined;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;
/** Bij een pauze: hoe vaak en hoe lang, voor het log bij het stoppen */
let pauses = 0;
let pausedMs = 0;
/**
 * Op Stop gedrukt (of de sessie gestopt) terwijl de microfoon nog aanging:
 * stoppen zodra hij aan is. Anders liep de telling door zonder stopknop.
 */
let stopWhenStarted = false;

/** Niet meer luisteren naar de service */
let nativeOff: (() => void) | undefined;

/**
 * Positie per stuk van de service, op het begin van het stuk opgevraagd.
 * Blijft staan na het stoppen: het laatste stuk komt pas daarna binnen.
 */
const chunkLookups = new Map<number, Promise<PositionLookup>>();
/** Ouder dan dit: dat stuk komt niet meer (stilte, weggegooid) */
const LOOKUP_KEEP_MS = 10 * 60_000;

/** De positie van het stuk dat op `startedAt` begon (eenmalig), als de service het meldde */
export function takeChunkLookup(startedAt: number): Promise<PositionLookup> | undefined {
  const lookup = chunkLookups.get(startedAt);
  chunkLookups.delete(startedAt);
  return lookup;
}

export function trektelSupported(): boolean {
  return 'MediaRecorder' in window && !!navigator.mediaDevices && 'AudioContext' in window;
}

function startChunk(): Chunk {
  const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream!, {
    ...(mimeType && { mimeType }),
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  const chunk: Chunk = {
    recorder,
    parts: [],
    startedAt: Date.now(),
    lookup: handlers!.onChunkStart(),
    onChunk: handlers!.onChunk,
  };
  recorder.ondataavailable = (event) => chunk.parts.push(event.data);
  recorder.start();
  return chunk;
}

/** Stopt een stuk; verstuurt het als er spraak in zat. */
function endChunk(chunk: Chunk, cut: Cut) {
  const send = () => {
    const audio = new Blob(chunk.parts, { type: chunk.recorder.mimeType });
    if (cut.hasSpeech && audio.size) {
      trektel.sent++;
      chunk.onChunk(
        { audio, startedAt: chunk.startedAt, durationMs: cut.durationMs },
        chunk.lookup,
      );
    } else {
      // Niet bewaard; wel gelogd, om de stiltedrempel te kunnen nalopen
      trektel.skipped++;
      logEvent('trektel_silence', { ...cut, bytes: audio.size });
    }
  };
  // Al vanzelf gestopt (het microfoonspoor hield op): de stukjes zijn er al
  if (chunk.recorder.state === 'inactive') {
    send();
    return;
  }
  chunk.recorder.onstop = send;
  chunk.recorder.stop();
}

/** Zo lang na een weggevallen spoor de microfoon opnieuw proberen */
export const TRACK_RETRY_MS = 1000;

/**
 * Het microfoonspoor hield op terwijl de app op het scherm stond (oortjes
 * weg, een andere app pakt de microfoon). Zonder dit telde de app stil door
 * met een dode microfoon. Pauzeren (het lopende stuk gaat mee, één lange
 * tril) en de microfoon opnieuw aanzetten; lukt dat niet, dan stopt de
 * telling zoals na een pauze. Gebeld worden zet de app meestal op de
 * achtergrond: dat is gewoon een pauze (onVisibility).
 */
function onTrackEnded(opened: MediaStream) {
  if (stream !== opened || trektel.status !== 'running') return;
  logEvent('trektel_track_ended');
  pauseTrektel();
  setTimeout(() => {
    if (trektel.status === 'paused' && !document.hidden) resumeTrektel();
  }, TRACK_RETRY_MS);
}

/** Houdt het scherm aan (de trektelling stopt als het scherm op slot gaat). */
async function keepScreenOn() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch (error) {
    logEvent('wake_lock_error', { message: (error as Error).message });
  }
}

function onVisibility() {
  if (trektel.native) return;
  if (document.hidden && trektel.status === 'running') {
    // Naar een andere app of scherm op slot: de microfoon niet onopgemerkt aan
    // laten, maar pauzeren tot je terugkomt
    pauseTrektel();
  } else if (!document.hidden && trektel.status === 'paused') {
    resumeTrektel();
  }
}

/** Microfoon aan, meter en eerste stuk starten. Gooit als de microfoon niet aangaat. */
async function openMic(): Promise<void> {
  stream = await openMicrophone();
  noteMicrophone(stream, 'trektel');
  const opened = stream;
  opened.getAudioTracks?.()[0]?.addEventListener('ended', () => onTrackEnded(opened));
  audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  const chunker = createChunker();

  current = startChunk();
  meter = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const cut = chunker.push(levelDb(samples));
    trektel.speaking = chunker.speaking;
    if (!cut || !current) return;
    const ended = current;
    current = startChunk();
    endChunk(ended, cut);
  }, FRAME_MS);
  // Bij het stoppen het laatste stuk afronden
  stopChunker = () => chunker.finish();
  await keepScreenOn();
}

/** Laatste stuk afronden en de microfoon echt uitzetten. */
function closeMic(): void {
  clearInterval(meter);
  if (current && stopChunker) endChunk(current, stopChunker());
  current = undefined;
  stopChunker = undefined;
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  audioContext?.close();
  audioContext = undefined;
  wakeLock?.release().catch(() => {});
  wakeLock = undefined;
  trektel.speaking = false;
}

function pauseTrektel(): void {
  if (!trektel.native) closeMic();
  trektel.status = 'paused';
  pausedAt = Date.now();
  pauses++;
  // Niet terug binnen een kwartier: dan was het geen even Merlin, maar weg
  pauseTimer = setTimeout(() => stopTrektel('hidden'), TREKTEL_PAUSE_MAX_MS);
  logEvent('trektel_paused');
  handlers?.onPaused?.();
}

async function resumeTrektel(): Promise<void> {
  clearTimeout(pauseTimer);
  const away = Date.now() - (pausedAt ?? Date.now());
  // De timer kan op de achtergrond te laat lopen: dan alsnog stoppen
  if (away > TREKTEL_PAUSE_MAX_MS) {
    stopTrektel('hidden');
    return;
  }
  trektel.status = 'starting';
  stopWhenStarted = false;
  try {
    await openMic();
  } catch {
    trektel.status = 'paused';
    stopTrektel('mic');
    // Niet stil stoppen: wie later kijkt, moet weten waarom
    trektel.error = t('trektel.micNotBack');
    return;
  }
  pausedMs += away;
  pausedAt = undefined;
  trektel.status = 'running';
  logEvent('trektel_resumed', { pausedMs: away });
  if (stopWhenStarted) {
    stopTrektel();
    return;
  }
  handlers?.onResumed?.();
  // Intussen alweer weg (de microfoon aanzetten duurt even): opnieuw pauzeren
  if (document.hidden) pauseTrektel();
}

/** Nieuws van de service (alleen met `trektel.native`) */
function onNativeEvent(event: NativeTrektelEvent): void {
  if (!trektel.native) return;
  switch (event.soort) {
    case 'stuk_begint': {
      const now = Date.now();
      for (const at of chunkLookups.keys()) if (now - at > LOOKUP_KEEP_MS) chunkLookups.delete(at);
      if (handlers) chunkLookups.set(event.data.startedAt, handlers.onChunkStart());
      break;
    }
    case 'spreekt':
      trektel.speaking = event.data.ja;
      break;
    case 'stuk':
      trektel.sent = event.data.stukken;
      trektel.skipped = event.data.stil;
      break;
    case 'gepauzeerd':
      // Een andere app (Merlin, een gesprek) heeft de microfoon
      if (trektel.status !== 'running') return;
      trektel.speaking = false;
      logEvent('trektel_native_paused', event.data);
      pauseTrektel();
      break;
    case 'hervat': {
      if (trektel.status !== 'paused') return;
      clearTimeout(pauseTimer);
      const away = Date.now() - (pausedAt ?? Date.now());
      if (away > TREKTEL_PAUSE_MAX_MS) {
        stopTrektel('hidden');
        return;
      }
      pausedMs += away;
      pausedAt = undefined;
      trektel.status = 'running';
      logEvent('trektel_resumed', {
        pausedMs: away,
        native: true,
        schermUit: event.data.schermUit,
      });
      handlers?.onResumed?.();
      break;
    }
    case 'gestopt': {
      // Vanzelf: het maximum, of de microfoon viel weg
      const reason: StopReason = event.data.reden === 'max' ? 'max' : 'mic';
      logNativeSummary(event.data);
      stopTrektel(reason);
      if (reason === 'mic') {
        trektel.error = t('trektel.micLost');
      }
      break;
    }
  }
}

function logNativeSummary(summary: NativeTrektelSummary): void {
  if (summary.reden === undefined) return; // Er liep niets meer
  logEvent('trektel_native_end', { ...summary });
}

/** Start de telling in de service. Geeft false als dat niet lukt (dan de webcode). */
async function startNative(): Promise<boolean> {
  nativeOff = listenNativeTrektel(onNativeEvent);
  const result = await startNativeTrektel({
    doelMs: CHUNK_OPTIONS.targetMs,
    pauzeMs: CHUNK_OPTIONS.pauseMs,
    maxStukMs: CHUNK_OPTIONS.maxMs,
    minSpraakMs: CHUNK_OPTIONS.minSpeechMs,
    margeDb: CHUNK_OPTIONS.marginDb,
    vloerDb: CHUNK_OPTIONS.absoluteFloorDb,
    maxMs: TREKTEL_MAX_MS,
  });
  if (!result.ok) {
    nativeOff();
    nativeOff = undefined;
    logEvent('trektel_native_failed', { reden: result.reden });
  }
  return result.ok;
}

export interface TrektelStartOptions {
  /** De service neemt op (proef scherm uit); lukt dat niet, dan de webcode */
  native?: boolean;
}

/** Geeft true terug als de trektelling loopt. */
export async function startTrektel(
  next: TrektelHandlers,
  options: TrektelStartOptions = {},
): Promise<boolean> {
  if (trektel.status !== 'idle') return false;
  // Tegelijk zetten: het sessiescherm laat de service alleen los bij een
  // trektelling van de webcode (status en native samen)
  Object.assign(trektel, { status: 'starting', native: !!options.native, error: undefined });
  stopWhenStarted = false;
  handlers = next;
  if (options.native) {
    if (await startNative()) {
      startRunning(true);
      if (stopWhenStarted) {
        stopTrektel();
        return false;
      }
      return true;
    }
    trektel.native = false;
  }
  try {
    await openMic();
  } catch (error) {
    closeMic();
    handlers = undefined;
    trektel.status = 'idle';
    trektel.error =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? t('session.micDenied')
        : t('trektel.micFailed');
    return false;
  }

  startRunning(false);
  if (stopWhenStarted) {
    stopTrektel();
    return false;
  }
  return true;
}

function startRunning(native: boolean): void {
  // Ook in de service: de service stopt zelf na 4 uur, dit is het vangnet
  maxTimer = setTimeout(() => stopTrektel('max'), TREKTEL_MAX_MS);
  if (!native) document.addEventListener('visibilitychange', onVisibility);
  pauses = 0;
  pausedMs = 0;
  Object.assign(trektel, { status: 'running', startedAt: Date.now(), sent: 0, skipped: 0 });
  logEvent('trektel_started', native ? { native: true, hidden: document.hidden } : undefined);
}

/** Stopt de trektelling; het laatste stuk wordt nog verwerkt. */
export function stopTrektel(reason?: StopReason): void {
  if (trektel.status === 'starting') stopWhenStarted = true;
  if (trektel.status !== 'running' && trektel.status !== 'paused') return;
  clearTimeout(maxTimer);
  clearTimeout(pauseTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  const native = trektel.native;
  if (native) {
    nativeOff?.();
    nativeOff = undefined;
    // Het laatste stuk komt daarna nog binnen (screenOff.svelte.ts)
    void stopNativeTrektel().then(logNativeSummary);
  } else {
    closeMic();
  }
  if (pausedAt !== undefined) pausedMs += Date.now() - pausedAt;
  pausedAt = undefined;

  logEvent('trektel_stopped', {
    reason: reason ?? 'button',
    durationMs: Date.now() - (trektel.startedAt ?? Date.now()),
    sent: trektel.sent,
    skipped: trektel.skipped,
    ...(pauses > 0 ? { pauses, pausedMs } : {}),
    ...(native && { native: true }),
  });
  if (reason) handlers?.onStopped(reason);
  handlers = undefined;
  Object.assign(trektel, { status: 'idle', startedAt: undefined, speaking: false, native: false });
}
