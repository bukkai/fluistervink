// Welkom voor nieuwelingen: wie de app voor het eerst opent (nog geen enkele
// sessie), krijgt op het hoofdscherm de eerste sessie stap voor stap, en kan
// alvast toestemming geven voor microfoon en locatie. Anders vraagt de
// telefoon dat midden in de eerste waarneming.

const WELCOME_DONE_KEY = 'fluistervink.welcomeDone';

/** Of het welkom al is weggeklikt op dit apparaat */
export function welcomeDone(): boolean {
  try {
    return localStorage.getItem(WELCOME_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWelcomeDone(): void {
  try {
    localStorage.setItem(WELCOME_DONE_KEY, '1');
  } catch {
    // Geblokkeerde opslag: dan alleen het welkom nog een keer, tot de eerste sessie
  }
}

export interface PermissionResult {
  microphone: boolean;
  location: boolean;
}

/**
 * Vraagt de telefoon om toestemming voor microfoon en locatie, zonder op te
 * nemen of een positie te bewaren. Locatie telt als gegeven als alleen de
 * meting mislukt (binnen, geen signaal): de toestemming is er dan wel.
 */
export async function askPermissions(): Promise<PermissionResult> {
  const microphone = await navigator.mediaDevices
    ?.getUserMedia({ audio: true })
    .then((stream) => {
      for (const track of stream.getTracks()) track.stop();
      return true;
    })
    .catch(() => false);
  const location = await new Promise<boolean>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => resolve(error.code !== error.PERMISSION_DENIED),
      { timeout: 15_000, maximumAge: Infinity },
    );
  });
  return { microphone: microphone ?? false, location };
}
