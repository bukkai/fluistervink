// Welke microfoon luistert, voor de regel op het sessiescherm (feedback 17 nov:
// "hoe weet ik of de microfoon van de telefoon of van mijn headset wordt
// gebruikt?"). Alleen iets te zeggen als er oortjes met microfoon zijn.

import { devOptionOn } from './devOptions';
import { logEvent } from './log';
import { headsetInList, micKind, type MicKind } from './microphone';
import { nativeMicrophoneStatus } from './native';

export const microphone = $state<{
  /** Oortjes of een headset met microfoon verbonden */
  headset: boolean;
  /** De microfoon van de laatste opname */
  using?: MicKind;
}>({ headset: false });

/** Kijkt of er oortjes zijn: de Android-app weet het zelf, de browser uit de lijst. */
export async function refreshMicrophones(): Promise<void> {
  const native = await nativeMicrophoneStatus();
  let inList = false;
  try {
    inList = headsetInList(await navigator.mediaDevices.enumerateDevices());
  } catch {
    // Geen lijst: dan alleen wat de app weet
  }
  microphone.headset = (native?.oortjes ?? false) || inList;
}

/** Na het aanzetten van de microfoon: welke het werd, in de status en het log. */
export function noteMicrophone(stream: MediaStream, mode: 'opname' | 'trektel'): void {
  // Alleen voor de status en het log: mag de opname nooit tegenhouden
  let track: MediaStreamTrack | undefined;
  try {
    [track] = stream.getAudioTracks();
  } catch {
    return;
  }
  const { deviceId: _, groupId: __, ...settings } = track?.getSettings?.() ?? {};
  microphone.using = micKind(track?.label);
  if (microphone.using === 'oortjes') microphone.headset = true;
  logEvent('mic_opened', {
    label: track?.label,
    ...settings,
    mode,
    ...(microphone.headset
      ? { headset: true, preferHeadset: devOptionOn('oortjesMicrofoon') }
      : {}),
  });
}

/** De regel op het sessiescherm, of niets als er geen oortjes zijn. */
export function microphoneLine(): string | undefined {
  if (!microphone.headset && microphone.using !== 'oortjes') return undefined;
  const expected = microphone.using ?? (devOptionOn('oortjesMicrofoon') ? 'oortjes' : 'telefoon');
  return expected === 'oortjes'
    ? 'Luistert met je oortjes'
    : 'Luistert met de telefoon, niet je oortjes';
}
