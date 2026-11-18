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
}

/**
 * Ruim genoeg voor spraak, en een kleine upload bij slecht bereik. Zonder
 * kiest de browser zelf, op een iPhone ±220 kbit/s (1,7 MB per minuut).
 */
export const AUDIO_BITS_PER_SECOND = 32_000;

/** Kortere opnames zijn een per ongeluk aangetikte knop. */
const MIN_DURATION_MS = 500;

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

/** Geeft true terug als de opname loopt. */
export async function startRecording(): Promise<boolean> {
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
  mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
  mediaRecorder.start();
  recorder.startedAt = Date.now();
  recorder.status = 'recording';
  return true;
}

/**
 * Stopt de opname en zet de microfoon uit. Geeft niets terug als er geen
 * opname liep of als hij te kort was.
 */
export function stopRecording(): Promise<Recording | undefined> {
  const current = mediaRecorder;
  const startedAt = recorder.startedAt;
  if (!current || current.state === 'inactive' || startedAt === undefined) {
    return Promise.resolve(undefined);
  }
  mediaRecorder = undefined;

  return new Promise((resolve) => {
    current.onstop = () => {
      current.stream.getTracks().forEach((track) => track.stop());
      recorder.status = 'idle';
      recorder.startedAt = undefined;

      const durationMs = Date.now() - startedAt;
      const audio = new Blob(chunks, { type: current.mimeType });
      resolve(
        durationMs < MIN_DURATION_MS || !audio.size ? undefined : { audio, startedAt, durationMs },
      );
    };
    current.stop();
  });
}
