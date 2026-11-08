// Opname in de trektelmodus (docs/plan-trektelmodus.md). De microfoon blijft
// aan; per stuk een nieuwe MediaRecorder op dezelfde stream, zodat elk stuk
// een los, afspeelbaar bestand is. Het nieuwe stuk start vóórdat het vorige
// stopt, zodat er tussen twee stukken niets wegvalt. Een AnalyserNode meet
// het geluidsniveau; de rekenregels voor het knippen staan in trektel.ts.

import type { PositionLookup } from './db';
import { logEvent } from './log';
import { microphoneConstraints } from './microphone';
import { AUDIO_BITS_PER_SECOND, MIME_TYPES, type Recording } from './recorder.svelte';
import { createChunker, FRAME_MS, levelDb, TREKTEL_MAX_MS, type Cut } from './trektel';

export interface TrektelHandlers {
  /** Bij het begin van elk stuk: de positie van dat moment opvragen. */
  onChunkStart: () => Promise<PositionLookup>;
  /** Een stuk met spraak; `startedAt` is het begin van dat stuk. */
  onChunk: (recording: Recording, lookup: Promise<PositionLookup>) => void;
  /** De trektelling stopte vanzelf (maximum, app naar de achtergrond). */
  onStopped: (reason: 'max' | 'hidden') => void;
}

export const trektel = $state<{
  status: 'idle' | 'starting' | 'running';
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
  if (trektel.status !== 'running') return;
  // Naar een andere app of scherm op slot: stoppen. De microfoon niet
  // onopgemerkt aan laten.
  if (document.hidden) {
    logEvent('trektel_stopped_hidden');
    stopTrektel('hidden');
  }
}

/** Geeft true terug als de trektelling loopt. */
export async function startTrektel(next: TrektelHandlers): Promise<boolean> {
  if (trektel.status !== 'idle') return false;
  trektel.status = 'starting';
  trektel.error = undefined;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: await microphoneConstraints() });
  } catch (error) {
    logEvent('mic_error', { name: (error as Error).name, message: (error as Error).message });
    trektel.status = 'idle';
    trektel.error =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Geen toegang tot de microfoon. Sta dit toe in de browserinstellingen.'
        : 'De microfoon gaat niet aan.';
    return false;
  }

  handlers = next;
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

  maxTimer = setTimeout(() => stopTrektel('max'), TREKTEL_MAX_MS);
  document.addEventListener('visibilitychange', onVisibility);
  await keepScreenOn();

  Object.assign(trektel, { status: 'running', startedAt: Date.now(), sent: 0, skipped: 0 });
  logEvent('trektel_started');
  return true;
}

/** Stopt de trektelling; het laatste stuk wordt nog verwerkt. */
export function stopTrektel(reason?: 'max' | 'hidden'): void {
  if (trektel.status !== 'running') return;
  clearInterval(meter);
  clearTimeout(maxTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  if (current && stopChunker) endChunk(current, stopChunker());
  current = undefined;
  stopChunker = undefined;
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  audioContext?.close();
  audioContext = undefined;
  wakeLock?.release().catch(() => {});
  wakeLock = undefined;

  logEvent('trektel_stopped', {
    reason: reason ?? 'button',
    durationMs: Date.now() - (trektel.startedAt ?? Date.now()),
    sent: trektel.sent,
    skipped: trektel.skipped,
  });
  if (reason) handlers?.onStopped(reason);
  handlers = undefined;
  Object.assign(trektel, { status: 'idle', startedAt: undefined, speaking: false });
}
