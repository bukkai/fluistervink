import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// GPS nagebootst: het gaat om wat het scherm zegt als de eerste plek lang
// uitblijft (offline, binnen), en hoe snel "Huidige locatie" het opgeeft.
vi.mock('./log', () => ({ logEvent: vi.fn() }));

import { logEvent } from './log';
import {
  gps,
  HERE_TIMEOUT_MS,
  hereMessage,
  positionNow,
  SLOW_MS,
  startTracking,
  stopTracking,
} from './location.svelte';

let onFix: ((fix: GeolocationPosition) => void) | undefined;
const getCurrentPosition = vi.fn();

function fix(at = Date.now()): GeolocationPosition {
  return {
    coords: { latitude: 52, longitude: 5, accuracy: 8 },
    timestamp: at,
  } as GeolocationPosition;
}

beforeEach(() => {
  vi.useFakeTimers();
  onFix = undefined;
  getCurrentPosition.mockReset();
  vi.mocked(logEvent).mockClear();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (success: (fix: GeolocationPosition) => void) => {
        onFix = success;
        return 1;
      },
      clearWatch: () => {},
      getCurrentPosition,
    },
  });
});

afterEach(() => {
  stopTracking();
  vi.useRealTimers();
});

describe('GPS tijdens een sessie', () => {
  it('meldt na SLOW_MS zonder plek dat het lang duurt', () => {
    startTracking();
    vi.advanceTimersByTime(SLOW_MS - 1);
    expect(gps.slow).toBeFalsy();
    vi.advanceTimersByTime(1);
    expect(gps.slow).toBe(true);
    expect(logEvent).toHaveBeenCalledWith(
      'gps_slow',
      expect.objectContaining({ afterMs: SLOW_MS }),
    );

    onFix?.(fix());
    expect(gps.status).toBe('ok');
    expect(gps.slow).toBe(false);
  });

  it('zegt niets als de plek op tijd komt', () => {
    startTracking();
    onFix?.(fix());
    vi.advanceTimersByTime(SLOW_MS);
    expect(gps.slow).toBeFalsy();
    expect(logEvent).not.toHaveBeenCalledWith('gps_slow', expect.anything());
  });
});

describe('Huidige locatie', () => {
  it('neemt de verse plek van een lopende sessie zonder opnieuw te meten', async () => {
    startTracking();
    onFix?.(fix());
    await expect(positionNow()).resolves.toMatchObject({ lat: 52, lon: 5 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('geeft het op na HERE_TIMEOUT_MS', async () => {
    void positionNow();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ timeout: HERE_TIMEOUT_MS });
  });

  it('noemt het ontbrekende bereik in de melding', () => {
    expect(hereMessage(false, false)).toMatch(/zonder bereik/);
    expect(hereMessage(false, true)).not.toMatch(/bereik/);
    expect(hereMessage(true, false)).toMatch(/mag je locatie niet/);
  });
});
