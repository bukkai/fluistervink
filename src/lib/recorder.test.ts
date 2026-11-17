import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Microfoon en opname nagebootst: het gaat om wat er gebeurt als de microfoon
// niet meteen aangaat.
vi.mock('./log', () => ({ logEvent: vi.fn() }));
vi.mock('./microphone', () => ({ microphoneConstraints: async () => true }));

// Vóór het importeren: recorder.status kijkt bij het laden of MediaRecorder bestaat
vi.hoisted(() => {
  class FakeRecorder {
    static isTypeSupported = () => true;
    mimeType = 'audio/webm';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    state = 'recording';
    constructor(public stream: unknown) {
      (globalThis as Record<string, unknown>).lastRecorder = this;
    }
    start() {}
    stop() {
      this.onstop?.();
    }
  }
  (globalThis as Record<string, unknown>).MediaRecorder = FakeRecorder;
});

import { logEvent } from './log';
import { recorder, startRecording, stopRecording } from './recorder.svelte';

const stream = { getTracks: () => [{ stop() {} }], getAudioTracks: () => [] };
let getUserMedia: ReturnType<typeof vi.fn>;

describe('microfoon aanzetten', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    recorder.status = 'idle';
    recorder.failed = undefined;
  });

  afterEach(async () => {
    await stopRecording();
    vi.useRealTimers();
    vi.mocked(logEvent).mockClear();
  });

  it('probeert het na "Could not start audio source" één keer opnieuw', async () => {
    getUserMedia
      .mockRejectedValueOnce(new DOMException('Could not start audio source', 'NotReadableError'))
      .mockResolvedValueOnce(stream);
    const started = startRecording();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await started).toBe(true);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(recorder.status).toBe('recording');
    expect(recorder.failed).toBeUndefined();
  });

  it('meldt het als ook de tweede poging mislukt', async () => {
    getUserMedia.mockRejectedValue(
      new DOMException('Could not start audio source', 'NotReadableError'),
    );
    const started = startRecording();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await started).toBe(false);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(recorder.status).toBe('idle');
    expect(recorder.failed).toBe(true);
  });

  it('geweigerde toegang: niet opnieuw, en niet als mislukt', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    expect(await startRecording()).toBe(false);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(recorder.status).toBe('denied');
    expect(recorder.failed).toBeUndefined();
  });

  it('telt met measureHidden de stukjes met het scherm aan en op slot', async () => {
    getUserMedia.mockResolvedValue(stream);
    expect(await startRecording({ measureHidden: true })).toBe(true);
    const fake = (globalThis as Record<string, unknown>).lastRecorder as {
      ondataavailable: (event: { data: Blob }) => void;
    };
    fake.ondataavailable({ data: new Blob(['x'.repeat(4000)]) });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      fake.ondataavailable({ data: new Blob(['x'.repeat(300)]) });
      fake.ondataavailable({ data: new Blob(['x'.repeat(200)]) });
    } finally {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    }
    await vi.advanceTimersByTimeAsync(3000);
    const recording = await stopRecording();
    expect(recording?.chunkStats).toEqual({
      visible: { count: 1, bytes: 4000 },
      hidden: { count: 2, bytes: 500 },
    });
  });
});
