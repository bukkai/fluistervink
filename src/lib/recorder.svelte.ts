import { openMicrophone } from './microphone';
import { noteMicrophone } from './microphoneStatus.svelte';

// Opname via de microfoon (MediaRecorder). De microfoon gaat alleen aan
// tijdens een opname en daarna meteen weer uit, zodat andere apps (Merlin) er
// tussendoor bij kunnen en het microfoon-icoon niet blijft staan.

export interface Recording {
  audio: Blob;
  /** Moment waarop de opname echt begon */
  startedAt: number;
  durationMs: number;
  /**
   * Met `measureHidden`: stukjes van een seconde met het scherm aan en op
   * slot, en hun grootte. Opus bij stilte is maar een paar honderd bytes per
   * seconde, spraak een paar kB: zo is te zien of er na het vergrendelen nog
   * geluid binnenkwam.
   */
  chunkStats?: { visible: ChunkCount; hidden: ChunkCount };
}

interface ChunkCount {
  count: number;
  bytes: number;
}

/**
 * Ruim genoeg voor spraak, en een kleine upload bij slecht bereik. Zonder
 * kiest de browser zelf, op een iPhone ±220 kbit/s (1,7 MB per minuut).
 */
export const AUDIO_BITS_PER_SECOND = 32_000;

/** Kortere opnames zijn een per ongeluk aangetikte knop. */
export const MIN_DURATION_MS = 500;

/** Bestandsformaten in volgorde van voorkeur; Chrome op Android kan webm/opus. */
export const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

/** Toestand voor de interface. */
export const recorder = $state<{
  status: 'idle' | 'starting' | 'recording' | 'denied' | 'unsupported';
  startedAt?: number;
  /** De laatste poging mislukte (niet geweigerd); weg bij de volgende start */
  failed?: boolean;
}>({
  status: 'MediaRecorder' in window && navigator.mediaDevices ? 'idle' : 'unsupported',
});

let mediaRecorder: MediaRecorder | undefined;
let chunks: Blob[] = [];
/** De opname zoals hij wordt als de recorder stopt (met de hand of vanzelf) */
let stopped: Promise<Recording | undefined> | undefined;
let stopRequested = false;

const interruptedListeners = new Set<() => void>();

/**
 * De opname stopte vanzelf: het microfoonspoor hield op (gebeld worden,
 * Bluetooth-oortjes weg, een andere app pakt de microfoon). Het sessiescherm
 * rondt hem dan af alsof op Stop gedrukt is, zodat wat er al was bewaard
 * wordt en de knop niet op "opnemen" blijft hangen. Geeft een functie om af
 * te melden.
 */
export function onRecordingInterrupted(listener: () => void): () => void {
  interruptedListeners.add(listener);
  return () => interruptedListeners.delete(listener);
}

/**
 * Geeft true terug als de opname loopt.
 * @param options.measureHidden Per seconde bijhouden of het scherm aan of op
 *   slot was (proef opnemen met het scherm uit, `chunkStats`)
 */
export async function startRecording(options: { measureHidden?: boolean } = {}): Promise<boolean> {
  if (recorder.status !== 'idle' && recorder.status !== 'denied') return false;
  recorder.status = 'starting';
  recorder.failed = undefined;

  let stream: MediaStream;
  try {
    stream = await openMicrophone();
  } catch (error) {
    const denied = error instanceof DOMException && error.name === 'NotAllowedError';
    recorder.status = denied ? 'denied' : 'idle';
    recorder.failed = !denied || undefined;
    return false;
  }

  // Welke microfoon het werd: voor het log (haperen van Bluetooth-audio) en het sessiescherm
  noteMicrophone(stream, 'opname');

  const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  mediaRecorder = new MediaRecorder(stream, {
    ...(mimeType && { mimeType }),
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  chunks = [];
  const current = mediaRecorder;
  const stats = options.measureHidden
    ? { visible: { count: 0, bytes: 0 }, hidden: { count: 0, bytes: 0 } }
    : undefined;
  current.ondataavailable = (event) => {
    chunks.push(event.data);
    if (!stats) return;
    const count = document.hidden ? stats.hidden : stats.visible;
    count.count++;
    count.bytes += event.data.size;
  };
  const startedAt = Date.now();
  stopRequested = false;
  stopped = new Promise((resolve) => {
    current.onstop = () => {
      current.stream.getTracks().forEach((track) => track.stop());
      recorder.status = 'idle';
      recorder.startedAt = undefined;

      const durationMs = Date.now() - startedAt;
      const audio = new Blob(chunks, { type: current.mimeType });
      resolve(
        durationMs < MIN_DURATION_MS || !audio.size
          ? undefined
          : { audio, startedAt, durationMs, ...(stats && { chunkStats: stats }) },
      );
      if (!stopRequested) for (const listener of interruptedListeners) listener();
    };
  });
  current.start(stats ? 1000 : undefined);
  recorder.startedAt = startedAt;
  recorder.status = 'recording';
  return true;
}

/**
 * Stopt de opname en zet de microfoon uit. Geeft niets terug als er geen
 * opname liep of als hij te kort was.
 */
export function stopRecording(): Promise<Recording | undefined> {
  const current = mediaRecorder;
  const result = stopped;
  if (!current || !result) return Promise.resolve(undefined);
  mediaRecorder = undefined;
  stopped = undefined;
  // Vanzelf gestopt (zie onRecordingInterrupted): de opname is er al
  if (current.state !== 'inactive') {
    stopRequested = true;
    current.stop();
  }
  return result;
}
