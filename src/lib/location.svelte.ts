import type { Position } from './db';
import { logEvent } from './log';

// GPS tijdens een wandeling. Een losse meting duurt vaak 5–20 seconden voordat
// hij nauwkeurig is; daarom houden we de GPS warm zolang er een wandeling
// loopt en nemen bij een uitspraak de meest recente positie. De tussenliggende
// posities bewaren we niet (een GPS-track valt buiten de MVP).

/** Een positie is vers genoeg als hij niet ouder is dan dit. */
const FRESH_MS = 15_000;
/** Ouder dan dit is onbruikbaar: je bent dan al te ver doorgelopen. */
const STALE_MS = 2 * 60_000;
/** Zo lang wachten we hooguit op een verse positie. */
const MAX_WAIT_MS = 10_000;

/** Toestand voor de interface; Svelte werkt de weergave automatisch bij. */
export const gps = $state<{
  status: 'off' | 'searching' | 'ok' | 'denied' | 'unavailable';
  latest?: Position;
}>({ status: 'off' });

let watchId: number | undefined;

export function startTracking(): void {
  if (watchId !== undefined) return;
  if (!('geolocation' in navigator)) {
    gps.status = 'unavailable';
    return;
  }
  gps.status = 'searching';
  const startedAt = Date.now();
  watchId = navigator.geolocation.watchPosition(
    (fix) => {
      gps.latest = toPosition(fix);
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
  gps.status = 'off';
  gps.latest = undefined;
}

/**
 * De positie op dit moment: de laatste meting als die vers is, anders een
 * nieuwe opvragen. Bij stilstaan (vogel kijken!) geeft watchPosition soms
 * minutenlang geen update, vandaar die extra vraag. Lukt dat niet binnen
 * MAX_WAIT_MS, dan een iets oudere meting, of niets.
 */
export async function currentPosition(): Promise<Position | undefined> {
  if (gps.status !== 'searching' && gps.status !== 'ok') return undefined;
  const age = (p?: Position) => (p ? Date.now() - p.fixedAt : Infinity);
  if (age(gps.latest) <= FRESH_MS) return $state.snapshot(gps.latest);

  const fresh = await new Promise<Position | undefined>((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (fix) => resolve(toPosition(fix)),
      () => resolve(undefined),
      { enableHighAccuracy: true, maximumAge: FRESH_MS, timeout: MAX_WAIT_MS },
    ),
  );
  if (fresh) return fresh;
  return age(gps.latest) <= STALE_MS ? $state.snapshot(gps.latest) : undefined;
}

function toPosition(fix: GeolocationPosition): Position {
  return {
    lat: fix.coords.latitude,
    lon: fix.coords.longitude,
    accuracy: fix.coords.accuracy,
    fixedAt: fix.timestamp,
  };
}
