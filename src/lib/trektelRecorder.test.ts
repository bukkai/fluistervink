import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Microfoon, geluidsmeter en opname nagebootst: het gaat hier om wanneer de
// microfoon aan en uit gaat, niet om het knippen (dat test trektel.test.ts).
vi.mock('./log', () => ({ logEvent: vi.fn() }));
vi.mock('./microphone', () => ({ microphoneConstraints: async () => true }));

import { TREKTEL_PAUSE_MAX_MS } from './trektel';
import { startTrektel, stopTrektel, trektel, type TrektelHandlers } from './trektelRecorder.svelte';

let hidden = false;
let micOn = 0;

class FakeRecorder {
  static isTypeSupported = () => true;
  mimeType = 'audio/webm';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start() {}
  stop() {
    this.onstop?.();
  }
}

class FakeAudioContext {
  createAnalyser() {
    return { fftSize: 0, getFloatTimeDomainData: () => {} };
  }
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  close() {
    return Promise.resolve();
  }
}

function setHidden(value: boolean) {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
}

function handlers(extra: Partial<TrektelHandlers> = {}): TrektelHandlers {
  return {
    onChunkStart: async () => ({ position: undefined }) as never,
    onChunk: vi.fn(),
    onStopped: vi.fn(),
    ...extra,
  };
}

describe('trektelling naar de achtergrond', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    micOn = 0;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          micOn++;
          return { getTracks: () => [{ stop: () => micOn-- }] };
        },
      },
    });
  });

  afterEach(() => {
    stopTrektel();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('microfoon uit bij Merlin, weer aan bij terugkomen', async () => {
    const h = handlers({ onPaused: vi.fn(), onResumed: vi.fn() });
    await startTrektel(h);
    const startedAt = trektel.startedAt;

    setHidden(true);
    expect(trektel.status).toBe('paused');
    expect(micOn).toBe(0);
    expect(h.onPaused).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(60_000);
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(trektel.status).toBe('running');
    expect(micOn).toBe(1);
    expect(h.onResumed).toHaveBeenCalledOnce();
    // Dezelfde telling: de klok loopt door
    expect(trektel.startedAt).toBe(startedAt);
    expect(h.onStopped).not.toHaveBeenCalled();
  });

  it('niet binnen een kwartier terug: alsnog stoppen', async () => {
    const h = handlers();
    await startTrektel(h);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(TREKTEL_PAUSE_MAX_MS + 1000);
    expect(trektel.status).toBe('idle');
    expect(h.onStopped).toHaveBeenCalledWith('hidden');
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(micOn).toBe(0);
  });

  it('stopknop tijdens de pauze: gewoon stoppen', async () => {
    const h = handlers();
    await startTrektel(h);
    setHidden(true);
    stopTrektel();
    expect(trektel.status).toBe('idle');
    expect(micOn).toBe(0);
  });

  it('alweer weg terwijl de microfoon aangaat: opnieuw pauzeren', async () => {
    const h = handlers();
    await startTrektel(h);
    setHidden(true);
    setHidden(false);
    hidden = true; // nog vóór de microfoon aan is, zonder nieuw event
    await vi.advanceTimersByTimeAsync(0);
    expect(trektel.status).toBe('paused');
    expect(micOn).toBe(0);
  });
});
