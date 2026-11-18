import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeTrektelEvent } from './native';

// Trektelling in de service (proef scherm uit): de service neemt op en knipt;
// de webcode houdt de stand bij, vraagt per stuk de positie op en stopt de
// telling bij het maximum, het plafond of een andere app die te lang blijft.
// De stukken zelf komen via screenOff.svelte.ts (screenOff.test.ts).

const native = vi.hoisted(() => ({
  listener: undefined as ((event: NativeTrektelEvent) => void) | undefined,
  off: vi.fn(),
  startNativeTrektel: vi.fn(),
  stopNativeTrektel: vi.fn(),
}));
vi.mock('./native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./native')>()),
  listenNativeTrektel: (listener: (event: NativeTrektelEvent) => void) => {
    native.listener = listener;
    return native.off;
  },
  startNativeTrektel: native.startNativeTrektel,
  stopNativeTrektel: native.stopNativeTrektel,
}));

const logEvent = vi.hoisted(() => vi.fn());
vi.mock('./log', () => ({ logEvent }));

const openMicrophone = vi.hoisted(() => vi.fn());
vi.mock('./microphone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./microphone')>()),
  openMicrophone,
}));

import { CHUNK_OPTIONS, TREKTEL_MAX_MS, TREKTEL_PAUSE_MAX_MS } from './trektel';
import {
  startTrektel,
  stopTrektel,
  takeChunkLookup,
  trektel,
  type TrektelHandlers,
} from './trektelRecorder.svelte';

function handlers(): TrektelHandlers {
  return {
    onChunkStart: vi.fn(async () => ({ source: 'recent' as const, waitMs: 0 })),
    onChunk: vi.fn(),
    onStopped: vi.fn(),
    onPaused: vi.fn(),
    onResumed: vi.fn(),
  };
}

const send = (event: NativeTrektelEvent) => native.listener?.(event);
const logged = (type: string) => logEvent.mock.calls.filter(([t]) => t === type).map(([, d]) => d);

describe('trektelling in de service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.listener = undefined;
    native.startNativeTrektel.mockResolvedValue({ ok: true });
    native.stopNativeTrektel.mockResolvedValue({
      reden: 'app',
      durationMs: 900_000,
      stukken: 12,
      stil: 3,
      accuBegin: 81,
      accuEind: 78,
    });
    openMicrophone.mockRejectedValue(new Error('niet in deze test'));
    trektel.error = undefined;
  });

  afterEach(() => {
    stopTrektel();
    vi.useRealTimers();
  });

  it('geeft de knipregels van de webcode aan de service, en opent zelf geen microfoon', async () => {
    const h = handlers();
    expect(await startTrektel(h, { native: true })).toBe(true);
    expect(native.startNativeTrektel).toHaveBeenCalledWith({
      doelMs: CHUNK_OPTIONS.targetMs,
      pauzeMs: CHUNK_OPTIONS.pauseMs,
      maxStukMs: CHUNK_OPTIONS.maxMs,
      minSpraakMs: CHUNK_OPTIONS.minSpeechMs,
      margeDb: CHUNK_OPTIONS.marginDb,
      vloerDb: CHUNK_OPTIONS.absoluteFloorDb,
      maxMs: TREKTEL_MAX_MS,
    });
    expect(openMicrophone).not.toHaveBeenCalled();
    expect(trektel).toMatchObject({ status: 'running', native: true });
    expect(logged('trektel_started')[0]).toMatchObject({ native: true });
  });

  it('scherm op slot of een ander scherm pauzeert niet: de service neemt door', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(trektel.status).toBe('running');
    expect(h.onPaused).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('vraagt de positie op bij het begin van elk stuk, voor één keer', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'stuk_begint', data: { startedAt: 5000 } });
    expect(h.onChunkStart).toHaveBeenCalledTimes(1);
    expect(await takeChunkLookup(5000)).toMatchObject({ source: 'recent' });
    expect(takeChunkLookup(5000)).toBeUndefined();
  });

  it('het laatste stuk vindt zijn positie ook na het stoppen', async () => {
    await startTrektel(handlers(), { native: true });
    send({ soort: 'stuk_begint', data: { startedAt: 7000 } });
    stopTrektel();
    expect(takeChunkLookup(7000)).toBeDefined();
  });

  it('houdt het lampje en de tellers bij', async () => {
    await startTrektel(handlers(), { native: true });
    send({ soort: 'spreekt', data: { ja: true } });
    expect(trektel.speaking).toBe(true);
    send({ soort: 'stuk', data: { stukken: 2, stil: 1 } });
    expect(trektel).toMatchObject({ sent: 2, skipped: 1 });
  });

  it('een andere app neemt de microfoon: pauze met tril, daarna verder', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'gepauzeerd', data: { waarom: 'android', schermUit: true } });
    expect(trektel.status).toBe('paused');
    expect(h.onPaused).toHaveBeenCalledTimes(1);
    expect(logged('trektel_native_paused')[0]).toMatchObject({ waarom: 'android' });
    send({ soort: 'hervat', data: { pausedMs: 30_000, schermUit: true } });
    expect(trektel.status).toBe('running');
    expect(h.onResumed).toHaveBeenCalledTimes(1);
    expect(native.stopNativeTrektel).not.toHaveBeenCalled();
  });

  it('blijft de microfoon langer dan een kwartier weg, dan stopt de telling', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'gepauzeerd', data: { waarom: 'android', schermUit: true } });
    vi.advanceTimersByTime(TREKTEL_PAUSE_MAX_MS + 1);
    expect(h.onStopped).toHaveBeenCalledWith('hidden');
    expect(native.stopNativeTrektel).toHaveBeenCalled();
    expect(trektel).toMatchObject({ status: 'idle', native: false });
  });

  it('te laat terug (de klok liep op de achtergrond achter): alsnog stoppen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'gepauzeerd', data: { waarom: 'nullen', schermUit: true } });
    vi.setSystemTime(Date.now() + TREKTEL_PAUSE_MAX_MS + 1);
    send({ soort: 'hervat', data: { pausedMs: TREKTEL_PAUSE_MAX_MS + 1, schermUit: true } });
    expect(h.onStopped).toHaveBeenCalledWith('hidden');
    expect(h.onResumed).not.toHaveBeenCalled();
  });

  it('de service stopt na het maximum: telling stopt met het eigen trilpatroon', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'gestopt', data: { reden: 'max', durationMs: TREKTEL_MAX_MS, stukken: 200 } });
    expect(h.onStopped).toHaveBeenCalledWith('max');
    expect(trektel.status).toBe('idle');
    expect(trektel.error).toBeUndefined();
    expect(logged('trektel_native_end')[0]).toMatchObject({ reden: 'max', stukken: 200 });
  });

  it('de microfoon valt weg in de service: stoppen met uitleg', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    send({ soort: 'gestopt', data: { reden: 'mic' } });
    expect(h.onStopped).toHaveBeenCalledWith('mic');
    expect(trektel.error).toContain('microfoon viel weg');
  });

  it('het plafond per dag stopt ook de service, met de accu in het log', async () => {
    const h = handlers();
    await startTrektel(h, { native: true });
    stopTrektel('limit');
    expect(native.stopNativeTrektel).toHaveBeenCalledTimes(1);
    expect(native.off).toHaveBeenCalled();
    expect(h.onStopped).toHaveBeenCalledWith('limit');
    expect(logged('trektel_stopped')[0]).toMatchObject({ reason: 'limit', native: true });
    await Promise.resolve();
    expect(logged('trektel_native_end')[0]).toMatchObject({ accuBegin: 81, accuEind: 78 });
  });

  it('negeert nieuws van de service als de telling niet in de service loopt', async () => {
    send({ soort: 'gestopt', data: { reden: 'max' } });
    expect(trektel.status).toBe('idle');
  });

  it('lukt starten in de service niet, dan de gewone trektelling van de webcode', async () => {
    native.startNativeTrektel.mockResolvedValue({ ok: false, reden: 'geen type microfoon' });
    expect(await startTrektel(handlers(), { native: true })).toBe(false);
    expect(logged('trektel_native_failed')[0]).toEqual({ reden: 'geen type microfoon' });
    expect(native.off).toHaveBeenCalled();
    // De webcode probeerde zelf de microfoon (die in deze test niet aangaat)
    expect(openMicrophone).toHaveBeenCalled();
    expect(trektel).toMatchObject({ status: 'idle', native: false });
  });
});
