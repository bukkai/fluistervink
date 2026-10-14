import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// De service van de Android-app volgt de lopende wandeling, en het log krijgt
// alleen een regel als de uitkomst verandert (niet bij elke opname).

const native = vi.hoisted(() => ({
  isNativeApp: true,
  startWalkService: vi.fn(),
  stopWalkService: vi.fn(),
  walkServiceStatus: vi.fn(),
}));
vi.mock('./native', () => native);

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('./log', () => ({ logEvent }));

const { syncWalkService } = await import('./walkService');

describe('syncWalkService', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    native.startWalkService.mockResolvedValue({ ok: true, meldingen: true });
    native.walkServiceStatus.mockResolvedValue({ draait: true });
    await syncWalkService(undefined);
    vi.clearAllMocks();
  });
  // Vóór het opruimen van de database (src/test-setup.ts), die echte timers nodig heeft
  afterEach(() => vi.useRealTimers());

  it('start bij een wandeling en logt dat één keer', async () => {
    await syncWalkService('w1');
    await syncWalkService('w1');
    expect(native.startWalkService).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      'walk_service_started',
      { ok: true, meldingen: true },
      { sessionId: 'w1' },
    );
  });

  it('logt opnieuw als het eerst niet lukte en daarna wel', async () => {
    native.startWalkService.mockResolvedValueOnce({ ok: false, reden: 'geen locatietoestemming' });
    await syncWalkService('w1');
    await syncWalkService('w1');
    expect(logEvent.mock.calls.map((call) => call[1])).toEqual([
      { ok: false, reden: 'geen locatietoestemming' },
      { ok: true, meldingen: true },
    ]);
  });

  it('logt als de service na het starten toch niet draait', async () => {
    native.walkServiceStatus.mockResolvedValue({ draait: false, fout: 'SecurityException' });
    await syncWalkService('w1');
    await vi.advanceTimersByTimeAsync(2000);
    expect(logEvent).toHaveBeenLastCalledWith(
      'walk_service_failed',
      { draait: false, fout: 'SecurityException' },
      { sessionId: 'w1' },
    );
  });

  it('stopt zonder wandeling', async () => {
    await syncWalkService('w1');
    await syncWalkService(undefined);
    expect(native.stopWalkService).toHaveBeenCalled();
    expect(logEvent).toHaveBeenLastCalledWith('walk_service_stopped');
  });
});
