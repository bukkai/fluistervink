// Welke microfoon en welke instellingen bij een opname. Doel: de podcast in de
// auto (Bluetooth) niet laten haperen tijdens het inspreken (13 okt).
//
// Vermoeden: Chrome op Android zet de telefoon bij een opname met
// echo-onderdrukking in "belmodus". Dan schakelt Bluetooth over naar de
// headset-microfoon (HFP) en pauzeert de muziek, en het terugschakelen hapert.
// Echo-onderdrukking is bij inspreken niet nodig (er speelt niets af), en de
// microfoon van de telefoon voorkomt dat de Bluetooth-microfoon gekozen wordt.
//
// Proef (ontwikkeloptie 'oortjesMicrofoon', feedback 17 nov): juist de
// microfoon van de oortjes, voor wie de telefoon in de zak heeft. In de
// Android-app ziet de WebView die pas met de toestemming "Apparaten in de
// buurt" (MicrofoonPlugin.java).

import { devOptionOn } from './devOptions';
import { logEvent } from './log';

/** Namen van microfoons die via Bluetooth of een headset lopen. */
const EXTERNAL = /bluetooth|headset|hands-?free|\bbt\b|car|auto/i;

/**
 * Microfoons van oortjes of een headset. Niet "Headset earpiece": zo noemt
 * Android het oorstukje van de telefoon zelf.
 */
const HEADSET = /bluetooth|wired headset|usb|hands-?free|\bbt\b|airpods|buds/i;

export type MicKind = 'telefoon' | 'oortjes';

/** Telefoon of oortjes, aan de naam van de microfoon; undefined zonder naam. */
export function micKind(label: string | undefined): MicKind | undefined {
  if (!label) return undefined;
  return HEADSET.test(label) && !/earpiece/i.test(label) ? 'oortjes' : 'telefoon';
}

const namedInputs = (devices: MediaDeviceInfo[]) =>
  devices.filter(
    (d) =>
      d.kind === 'audioinput' &&
      d.label &&
      d.deviceId !== 'default' &&
      d.deviceId !== 'communications',
  );

/** Staat er een microfoon van oortjes of een headset in de lijst van de browser? */
export function headsetInList(devices: MediaDeviceInfo[]): boolean {
  return namedInputs(devices).some((d) => micKind(d.label) === 'oortjes');
}

/**
 * De microfoon van de telefoon zelf (of met `preferHeadset` die van de
 * oortjes, en anders toch de telefoon), of undefined als de browser het niet
 * weet (geen namen zonder toestemming) of er geen andere is dan de standaard.
 */
export function pickMicrophone(
  devices: MediaDeviceInfo[],
  preferHeadset = false,
): string | undefined {
  const inputs = namedInputs(devices);
  const headset = preferHeadset
    ? inputs.find((d) => micKind(d.label) === 'oortjes')?.deviceId
    : undefined;
  return headset ?? inputs.find((d) => !EXTERNAL.test(d.label))?.deviceId;
}

/** Instellingen voor `getUserMedia`: liever (niet verplicht) de gekozen microfoon. */
export async function microphoneConstraints(): Promise<MediaTrackConstraints> {
  let deviceId: string | undefined;
  try {
    deviceId = pickMicrophone(
      await navigator.mediaDevices.enumerateDevices(),
      devOptionOn('oortjesMicrofoon'),
    );
  } catch {
    // Zonder lijst gewoon de standaardmicrofoon
  }
  return {
    channelCount: 1,
    echoCancellation: false,
    ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
  };
}

/**
 * De microfoon ging niet aan, maar niet omdat toegang geweigerd is. Op Android
 * gebeurt dat vaak één keer, vlak na het geven van toestemming
 * (NotReadableError "Could not start audio source"); de tweede poging lukt dan.
 * Op 18 nov ook bij de trektelling, vlak na de vraag om locatietoestemming.
 */
const RETRY_ERRORS = ['NotReadableError', 'AbortError'];
export const RETRY_AFTER_MS = 500;

/**
 * Zet de microfoon aan, met zo nodig één tweede poging. Elke mislukte poging
 * komt in het log (`mic_error`); gooit de fout van de laatste.
 */
export async function openMicrophone(): Promise<MediaStream> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: await microphoneConstraints() });
    } catch (error) {
      const { name, message } = error as Error;
      const retry = attempt === 1 && RETRY_ERRORS.includes(name);
      logEvent('mic_error', { name, message, attempt, retry });
      if (!retry) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    }
  }
}
