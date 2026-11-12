import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// De service van de Android-app volgt de lopende sessie, en het log krijgt
// alleen een regel als de uitkomst verandert (niet bij elke opname).

const native = vi.hoisted(() => ({
  isNativeApp: true,
  startSessionService: vi.fn(),
  stopSessionService: vi.fn(),
  sessionServiceStatus: vi.fn(),
}));
vi.mock('./native', () => native);

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('./log', () => ({ logEvent }));

const { syncSessionService } = await import('./sessionService');

describe('syncSessionService', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    native.startSessionService.mockResolvedValue({ ok: true, meldingen: true });
    native.sessionServiceStatus.mockResolvedValue({ draait: true });
    await syncSessionService(undefined);
    vi.clearAllMocks();
  });
  // Vóór het opruimen van de database (src/test-setup.ts), die echte timers nodig heeft
  afterEach(() => vi.useRealTimers());

  it('start bij een sessie en logt dat één keer', async () => {
    await syncSessionService('w1');
    await syncSessionService('w1');
    expect(native.startSessionService).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      'walk_service_started',
      { ok: true, meldingen: true },
      { sessionId: 'w1' },
    );
  });

  it('logt opnieuw als het eerst niet lukte en daarna wel', async () => {
    native.startSessionService.mockResolvedValueOnce({
      ok: false,
      reden: 'geen locatietoestemming',
    });
    await syncSessionService('w1');
    await syncSessionService('w1');
    expect(logEvent.mock.calls.map((call) => call[1])).toEqual([
      { ok: false, reden: 'geen locatietoestemming' },
      { ok: true, meldingen: true },
    ]);
  });

  it('logt als de service na het starten toch niet draait', async () => {
    native.sessionServiceStatus.mockResolvedValue({ draait: false, fout: 'SecurityException' });
    await syncSessionService('w1');
    await vi.advanceTimersByTimeAsync(2000);
    expect(logEvent).toHaveBeenLastCalledWith(
      'walk_service_failed',
      { draait: false, fout: 'SecurityException' },
      { sessionId: 'w1' },
    );
  });

  it('stopt zonder sessie', async () => {
    await syncSessionService('w1');
    await syncSessionService(undefined);
    expect(native.stopSessionService).toHaveBeenCalled();
    expect(logEvent).toHaveBeenLastCalledWith('walk_service_stopped');
  });
});
