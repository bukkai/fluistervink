// Opname in de trektelmodus (docs/plan-trektelmodus.md). De microfoon blijft
// aan; per stuk een nieuwe MediaRecorder op dezelfde stream, zodat elk stuk
// een los, afspeelbaar bestand is. Het nieuwe stuk start vóórdat het vorige
// stopt, zodat er tussen twee stukken niets wegvalt. Een AnalyserNode meet
// het geluidsniveau; de rekenregels voor het knippen staan in trektel.ts.

import type { PositionLookup } from './db';
import { logEvent } from './log';
import { microphoneConstraints } from './microphone';
import { AUDIO_BITS_PER_SECOND, MIME_TYPES, type Recording } from './recorder.svelte';
import {
  createChunker,
  FRAME_MS,
  levelDb,
  TREKTEL_MAX_MS,
  TREKTEL_PAUSE_MAX_MS,
  type Cut,
} from './trektel';

/** `limit`: de proxy verwerkt vandaag niets meer (plafond per dag) */
type StopReason = 'max' | 'hidden' | 'limit';

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
}>({ status: 'idle', speaking: false, sent: 0, skipped: 0 });

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
  chunk.recorder.onstop = () => {
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
  chunk.recorder.stop();
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
  stream = await navigator.mediaDevices.getUserMedia({ audio: await microphoneConstraints() });
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
  closeMic();
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
  } catch (error) {
    logEvent('mic_error', { name: (error as Error).name, message: (error as Error).message });
    trektel.status = 'paused';
    stopTrektel('hidden');
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

/** Geeft true terug als de trektelling loopt. */
export async function startTrektel(next: TrektelHandlers): Promise<boolean> {
  if (trektel.status !== 'idle') return false;
  trektel.status = 'starting';
  trektel.error = undefined;
  stopWhenStarted = false;
  handlers = next;
  try {
    await openMic();
  } catch (error) {
    closeMic();
    handlers = undefined;
    logEvent('mic_error', { name: (error as Error).name, message: (error as Error).message });
    trektel.status = 'idle';
    trektel.error =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Geen toegang tot de microfoon. Sta dit toe in de browserinstellingen.'
        : 'De microfoon gaat niet aan.';
    return false;
  }

  maxTimer = setTimeout(() => stopTrektel('max'), TREKTEL_MAX_MS);
  document.addEventListener('visibilitychange', onVisibility);
  pauses = 0;
  pausedMs = 0;

  Object.assign(trektel, { status: 'running', startedAt: Date.now(), sent: 0, skipped: 0 });
  logEvent('trektel_started');
  if (stopWhenStarted) {
    stopTrektel();
    return false;
  }
  return true;
}

/** Stopt de trektelling; het laatste stuk wordt nog verwerkt. */
export function stopTrektel(reason?: StopReason): void {
  if (trektel.status === 'starting') stopWhenStarted = true;
  if (trektel.status !== 'running' && trektel.status !== 'paused') return;
  clearTimeout(maxTimer);
  clearTimeout(pauseTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  closeMic();
  if (pausedAt !== undefined) pausedMs += Date.now() - pausedAt;
  pausedAt = undefined;

  logEvent('trektel_stopped', {
    reason: reason ?? 'button',
    durationMs: Date.now() - (trektel.startedAt ?? Date.now()),
    sent: trektel.sent,
    skipped: trektel.skipped,
    ...(pauses > 0 ? { pauses, pausedMs } : {}),
  });
  if (reason) handlers?.onStopped(reason);
  handlers = undefined;
  Object.assign(trektel, { status: 'idle', startedAt: undefined, speaking: false });
}
