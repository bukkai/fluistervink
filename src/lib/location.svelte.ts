import type { Position, PositionLookup } from './db';
import { logEvent } from './log';

// GPS tijdens een sessie. Een losse meting duurt vaak 5–20 seconden voordat
// hij nauwkeurig is; daarom houden we de GPS warm zolang er een sessie
// loopt en nemen bij een uitspraak de meest recente positie. De tussenliggende
// posities bewaren we niet (een GPS-track valt buiten de MVP).

/** Een positie is vers genoeg als hij niet ouder is dan dit. */
const FRESH_MS = 15_000;
/** Zo lang wachten we hooguit op een verse positie. */
const MAX_WAIT_MS = 10_000;
/**
 * Na zo lang zoeken zonder plek zegt het sessiescherm dat inspreken gewoon
 * kan. Zonder bereik (vliegtuigmodus, binnen) duurt de eerste plek soms
 * minuten (17 nov: ruim 3 minuten), en "Locatie zoeken…" lijkt dan te hangen.
 */
export const SLOW_MS = 30_000;
/** "Huidige locatie" op het kaartje geeft het na zo lang op. */
export const HERE_TIMEOUT_MS = 10_000;

/** Toestand voor de interface; Svelte werkt de weergave automatisch bij. */
export const gps = $state<{
  status: 'off' | 'searching' | 'ok' | 'denied' | 'unavailable';
  latest?: Position;
  /** Al langer dan SLOW_MS aan het zoeken, nog nooit een plek gehad */
  slow?: boolean;
}>({ status: 'off' });

let watchId: number | undefined;
let slowTimer: ReturnType<typeof setTimeout> | undefined;

export function startTracking(): void {
  if (watchId !== undefined) return;
  if (!('geolocation' in navigator)) {
    gps.status = 'unavailable';
    return;
  }
  gps.status = 'searching';
  const startedAt = Date.now();
  slowTimer = setTimeout(() => {
    if (gps.status !== 'searching' || gps.latest) return;
    gps.slow = true;
    logEvent('gps_slow', { afterMs: Date.now() - startedAt, online: navigator.onLine });
  }, SLOW_MS);
  watchId = navigator.geolocation.watchPosition(
    (fix) => {
      gps.latest = toPosition(fix);
      gps.slow = false;
      if (gps.status !== 'ok') {
        // Hoe lang het duurt voor er een positie is, en hoe nauwkeurig die is
        logEvent('gps_fix', { afterMs: Date.now() - startedAt, accuracy: fix.coords.accuracy });
      }
      gps.status = 'ok';
    },
    (error) => {
      const status = error.code === error.PERMISSION_DENIED ? 'denied' : 'searching';
      if (status !== gps.status)
        logEvent('gps_error', { code: error.code, message: error.message });
      gps.status = status;
    },
    { enableHighAccuracy: true, maximumAge: 0 },
  );
}

export function stopTracking(): void {
  if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
  watchId = undefined;
  clearTimeout(slowTimer);
  slowTimer = undefined;
  gps.status = 'off';
  gps.latest = undefined;
  gps.slow = false;
}

/**
 * De positie op dit moment: de laatste meting als die vers is, anders een
 * nieuwe opvragen. Bij stilstaan (vogel kijken!) geeft watchPosition soms
 * minutenlang geen update, vandaar die extra vraag. Lukt dat niet binnen
 * MAX_WAIT_MS, dan de laatst bekende positie, hoe oud ook: wie lang bij een
 * hut of vogelscherm staat, is daar nog steeds. De meettijd blijft bewaard,
 * zodat in de review te zien is hoe oud hij was.
 */
export async function currentPosition(): Promise<PositionLookup> {
  const start = Date.now();
  const result = (source: PositionLookup['source'], position?: Position, error?: string) => ({
    source,
    position,
    waitMs: Date.now() - start,
    ...(error && { error }),
  });

  if (gps.status !== 'searching' && gps.status !== 'ok')
    return result('none', undefined, gps.status);
  const latest = gps.latest && $state.snapshot(gps.latest);
  if (latest && start - latest.fixedAt <= FRESH_MS) return result('recent', latest);

  let error: string | undefined;
  const fresh = await new Promise<Position | undefined>((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (fix) => resolve(toPosition(fix)),
      (e) => {
        error = e.message || `code ${e.code}`;
        resolve(undefined);
      },
      { enableHighAccuracy: true, maximumAge: FRESH_MS, timeout: MAX_WAIT_MS },
    ),
  );
  if (fresh) return result('fresh', fresh);
  return latest ? result('last_known', latest, error) : result('none', undefined, error);
}

/**
 * Eén losse meting, buiten een sessie: de knop "Huidige locatie" op het kaartje
 * van Locatie aanpassen. Geeft bij een fout een zin voor op het scherm.
 */
export function positionNow(): Promise<Position> {
  // Loopt er een sessie, dan is de GPS al warm: een verse plek meteen geven
  if (gps.latest && Date.now() - gps.latest.fixedAt <= FRESH_MS)
    return Promise.resolve($state.snapshot(gps.latest));
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Deze telefoon of browser geeft geen locatie.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (fix) => resolve(toPosition(fix)),
      (error) => {
        logEvent('gps_error', {
          code: error.code,
          message: error.message,
          by: 'here',
          online: navigator.onLine,
        });
        reject(new Error(hereMessage(error.code === error.PERMISSION_DENIED)));
      },
      { enableHighAccuracy: true, maximumAge: FRESH_MS, timeout: HERE_TIMEOUT_MS },
    );
  });
}

/** Zin op het scherm als "Huidige locatie" niet lukt. */
export function hereMessage(denied: boolean, online = navigator.onLine): string {
  if (denied)
    return 'De app mag je locatie niet gebruiken. Zet dat aan bij de instellingen van je telefoon.';
  return online
    ? 'Je plek is niet gevonden. Probeer het buiten nog eens, of tik op de kaart.'
    : 'Je plek is niet gevonden: zonder bereik doet de GPS er soms minuten over. Tik op de kaart, of probeer het later nog eens.';
}

function toPosition(fix: GeolocationPosition): Position {
  return {
    lat: fix.coords.latitude,
    lon: fix.coords.longitude,
    accuracy: fix.coords.accuracy,
    fixedAt: fix.timestamp,
  };
}
