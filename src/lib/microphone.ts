// Welke microfoon en welke instellingen bij een opname. Doel: de podcast in de
// auto (Bluetooth) niet laten haperen tijdens het inspreken (13 okt).
//
// Vermoeden: Chrome op Android zet de telefoon bij een opname met
// echo-onderdrukking in "belmodus". Dan schakelt Bluetooth over naar de
// headset-microfoon (HFP) en pauzeert de muziek, en het terugschakelen hapert.
// Echo-onderdrukking is bij inspreken niet nodig (er speelt niets af), en de
// microfoon van de telefoon voorkomt dat de Bluetooth-microfoon gekozen wordt.

/** Namen van microfoons die via Bluetooth of een headset lopen. */
const EXTERNAL = /bluetooth|headset|hands-?free|\bbt\b|car|auto/i;

/**
 * De microfoon van de telefoon zelf, of undefined als de browser het niet
 * weet (geen namen zonder toestemming) of er geen andere is dan de standaard.
 */
export function pickMicrophone(devices: MediaDeviceInfo[]): string | undefined {
  const inputs = devices.filter(
    (d) =>
      d.kind === 'audioinput' &&
      d.label &&
      d.deviceId !== 'default' &&
      d.deviceId !== 'communications',
  );
  return inputs.find((d) => !EXTERNAL.test(d.label))?.deviceId;
}

/** Instellingen voor `getUserMedia`: liever (niet verplicht) de eigen microfoon. */
export async function microphoneConstraints(): Promise<MediaTrackConstraints> {
  let deviceId: string | undefined;
  try {
    deviceId = pickMicrophone(await navigator.mediaDevices.enumerateDevices());
  } catch {
    // Zonder lijst gewoon de standaardmicrofoon
  }
  return {
    channelCount: 1,
    echoCancellation: false,
    ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
  };
}
