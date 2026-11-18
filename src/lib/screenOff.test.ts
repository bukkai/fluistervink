import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenOffHandlers, ScreenOffRecording } from './native';

// Opnemen met het scherm uit (proef): de service geeft een opname af, de
// webcode bewaart hem zoals een opname van de knop, en pas daarna mag het
// bestand op de telefoon weg. Het log meet hoe lang de overdracht duurde.

const native = vi.hoisted(() => ({
  screenOffSupported: true,
  listenScreenOff: vi.fn(),
  pendingScreenOffRecordings: vi.fn(),
  doneScreenOffRecording: vi.fn(),
  stopScreenOffRecording: vi.fn(),
}));
vi.mock('./native', () => native);

const submitRecording = vi.hoisted(() => vi.fn());
vi.mock('./queue', () => ({ submitRecording }));

const currentPosition = vi.hoisted(() => vi.fn());
vi.mock('./location.svelte', () => ({ currentPosition }));

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('./log', () => ({ logEvent }));

const devOptionOn = vi.hoisted(() => vi.fn());
vi.mock('./devOptions', () => ({ devOptionOn }));

const { receiveScreenOffRecording, screenOff, startScreenOff } = await import('./screenOff.svelte');

let nextId = 0;
function recording(fields: Partial<ScreenOffRecording> = {}): ScreenOffRecording {
  return {
    id: `s1_${1000 + nextId}_2000.m4a`,
    sessieId: 's1',
    startedAt: 1000 + nextId++,
    durationMs: 2000,
    type: 'audio/mp4',
    data: btoa('abc'),
    ...fields,
  };
}

/** Wacht tot alle beloftes van een afgegeven opname klaar zijn */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const lookup = { source: 'recent' as const, waitMs: 0 };

describe('opnemen met het scherm uit', () => {
  let handlers: ScreenOffHandlers;
  const stop = vi.fn();
  const onPress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    screenOff.startedAt = undefined;
    screenOff.ready = undefined;
    devOptionOn.mockReturnValue(true);
    native.pendingScreenOffRecordings.mockResolvedValue([]);
    native.doneScreenOffRecording.mockResolvedValue(undefined);
    native.listenScreenOff.mockImplementation((_options, h: ScreenOffHandlers) => {
      handlers = h;
      return { done: Promise.resolve({ ok: true }), stop };
    });
    submitRecording.mockResolvedValue(undefined);
    currentPosition.mockResolvedValue(lookup);
  });

  it('doet niets zonder de ontwikkeloptie', () => {
    devOptionOn.mockReturnValue(false);
    startScreenOff('s1', 180_000, onPress)();
    expect(native.listenScreenOff).not.toHaveBeenCalled();
  });

  it('geeft de regels van de webknop en de trilpatronen mee', () => {
    startScreenOff('s1', 180_000, onPress);
    expect(native.listenScreenOff.mock.calls[0][0]).toEqual({
      sessieId: 's1',
      maxMs: 180_000,
      minMs: 500,
      trilStart: [40, 60, 40],
      trilStop: [400],
    });
  });

  it('bewaart de opname met de positie van het begin, en ruimt dan het bestand op', async () => {
    startScreenOff('s1', 180_000, onPress);
    handlers.onStart(1000, 'volume_up');
    expect(screenOff.startedAt).toBe(1000);
    expect(currentPosition).toHaveBeenCalledTimes(1);

    const rec = recording({ gestoptAt: Date.now() - 50, verstuurdAt: Date.now() - 10, piek: 9000 });
    handlers.onRecording(rec);
    expect(screenOff.startedAt).toBeUndefined();
    await settle();

    expect(submitRecording).toHaveBeenCalledTimes(1);
    const [sessionId, stored, position] = submitRecording.mock.calls[0];
    expect(sessionId).toBe('s1');
    expect(stored.startedAt).toBe(rec.startedAt);
    expect(stored.durationMs).toBe(2000);
    expect(stored.audio.type).toBe('audio/mp4');
    expect(await stored.audio.text()).toBe('abc');
    expect(await position).toBe(lookup);
    expect(native.doneScreenOffRecording).toHaveBeenCalledWith(rec.id);

    const logged = logEvent.mock.calls.find(([type]) => type === 'screen_off_recording');
    expect(logged?.[1]).toMatchObject({ durationMs: 2000, bytes: 3, peak: 9000 });
    expect(logged?.[1].transferMs).toBeGreaterThanOrEqual(50);
    expect(logged?.[1].bridgeMs).toBeGreaterThanOrEqual(10);
    expect(logged?.[1].pending).toBeUndefined();
  });

  it('haalt opnames op die binnenkwamen terwijl de app dicht was, zonder positie', async () => {
    const rec = recording();
    native.pendingScreenOffRecordings.mockResolvedValue([rec]);
    startScreenOff('s1', 180_000, onPress);
    await settle();
    expect(submitRecording).toHaveBeenCalledTimes(1);
    expect((await submitRecording.mock.calls[0][2]).source).toBe('none');
    const logged = logEvent.mock.calls.find(([type]) => type === 'screen_off_recording');
    expect(logged?.[1].pending).toBe(true);
  });

  it('bewaart dezelfde opname maar één keer', async () => {
    const rec = recording();
    await Promise.all([
      receiveScreenOffRecording(rec, undefined),
      receiveScreenOffRecording(rec, undefined),
    ]);
    expect(submitRecording).toHaveBeenCalledTimes(1);
  });

  it('laat het bestand staan als bewaren mislukt, zodat het later nog eens kan', async () => {
    submitRecording.mockRejectedValueOnce(new Error('database'));
    const rec = recording();
    await receiveScreenOffRecording(rec, undefined);
    expect(native.doneScreenOffRecording).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'screen_off_failed',
      expect.objectContaining({ id: rec.id }),
      { sessionId: 's1' },
    );
    await receiveScreenOffRecording(rec, undefined);
    expect(native.doneScreenOffRecording).toHaveBeenCalledWith(rec.id);
  });

  it('zet meldingen van de service in het log en zet de knop terug bij een weggegooide opname', () => {
    startScreenOff('s1', 180_000, onPress);
    handlers.onStart(1000, 'volume_down');
    handlers.onLog('weggegooid', { durationMs: 200 });
    expect(screenOff.startedAt).toBeUndefined();
    expect(logEvent).toHaveBeenCalledWith(
      'screen_off_weggegooid',
      { durationMs: 200 },
      { sessionId: 's1' },
    );
  });

  it('is klaar voor doorlopende opnames zodra de service het type microfoon heeft', async () => {
    native.listenScreenOff.mockImplementation((_options, h: ScreenOffHandlers) => {
      handlers = h;
      return { done: Promise.resolve({ ok: false, reden: 'service draait niet' }), stop };
    });
    startScreenOff('s1', 180_000, onPress);
    await settle();
    expect(screenOff.ready).toBeUndefined();
    handlers.onLog('knop_aan', { schermUit: true, microfoon: true });
    expect(screenOff.ready).toBe(true);
  });

  it('geeft de volumeknop door als de webcode zelf opneemt', () => {
    startScreenOff('s1', 180_000, onPress);
    handlers.onPress('volume_up');
    expect(onPress).toHaveBeenCalledWith('volume_up');
  });

  it('de knop op de oortjes: opname met `oortjes` als bron, toetsen in het log', async () => {
    startScreenOff('s1', 180_000, onPress);
    handlers.onLog('knop_claim', {
      waarom: 'sessie',
      ok: true,
      anderGeluid: true,
      audiofocus: false,
    });
    handlers.onLog('mediaknop', { toets: 'KEYCODE_MEDIA_PLAY_PAUSE', actie: 'druk' });
    handlers.onStart(1000, 'oortjes');
    expect(screenOff.startedAt).toBe(1000);
    handlers.onLog('mediaknop', { toets: 'KEYCODE_MEDIA_PLAY_PAUSE', actie: 'dubbel' });
    handlers.onRecording(recording({ start: 'oortjes', stop: 'oortjes' }));
    await settle();

    const types = logEvent.mock.calls.map(([type]) => type);
    expect(types).toEqual(
      expect.arrayContaining([
        'screen_off_knop_claim',
        'screen_off_mediaknop',
        'screen_off_started',
        'screen_off_recording',
      ]),
    );
    expect(logEvent).toHaveBeenCalledWith(
      'screen_off_started',
      expect.objectContaining({ via: 'oortjes' }),
      { sessionId: 's1' },
    );
    const logged = logEvent.mock.calls.find(([type]) => type === 'screen_off_recording');
    expect(logged?.[1]).toMatchObject({ start: 'oortjes', stop: 'oortjes' });
    // Een dubbele druk stopt niets in de webcode
    expect(onPress).not.toHaveBeenCalled();
  });

  it('de knop op de oortjes stopt een opname van de webcode', () => {
    startScreenOff('s1', 180_000, onPress);
    handlers.onPress('oortjes');
    expect(onPress).toHaveBeenCalledWith('oortjes');
  });

  it('uitzetten stopt de service-kant', () => {
    const off = startScreenOff('s1', 180_000, onPress);
    handlers.onStart(1000, 'volume_up');
    off();
    expect(stop).toHaveBeenCalled();
    expect(screenOff.startedAt).toBeUndefined();
    expect(screenOff.ready).toBeUndefined();
  });
});
